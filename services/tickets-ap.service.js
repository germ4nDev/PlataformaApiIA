/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Service Layer Sanitization & Transactional Integrity
*/
const { sequelize } = require('../database/connection');
const { TicketAPModel, TicketAPDTO } = require('../models/ticket-ap');
const { io } = require('../index');

class TicketAPService {
  constructor() {
    this.model = TicketAPModel(sequelize);
  }

  async getTickets(filtros = {}, esParaIA = false) {
    try {
      const queryOptions = {
        where: filtros,
      };

      if (esParaIA) {
        queryOptions.attributes = [
          'fechaTicket',
          'nombreTicket',
          'descripcionTicket',
          'estadoTicket'
        ];
      }

      return await this.model.findAll(queryOptions);

    } catch (error) {
      console.error("Error en TicketsService:", error);
      throw error;
    }
  }

  async getTicketById(codigoTicket) {
    const registro = await this.model.findOne({ where: { codigoTicket } });
    if (!registro) throw { statusCode: 404, msg: "No existe el ticket solicitado." };
    return registro;
  }

  /**
   * Crea un nuevo ticket de soporte/atención
   */
  async createTicket(rawData) {
    const dataDTO = TicketAPDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const nuevo = await this.model.create(dataDTO, { transaction: t });

      io.emit('tickets-ap-actualizados', {
        action: 'create',
        msg: `Ticket creado: ${nuevo.nombreTicket}`
      });

      return nuevo;
    });
  }

  /**
   * Actualiza un ticket existente
   */
  async updateTicket(codigoTicket, rawData) {
    // El controlador inyecta el codigoUsuario en rawData antes de invocar este método
    const dataDTO = TicketAPDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoTicket },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: 'No existe el ticket para actualizar.' };

      await this.model.update(dataDTO, {
        where: { codigoTicket },
        transaction: t
      });

      const actualizado = await this.model.findOne({
        where: { codigoTicket },
        transaction: t
      });

      io.emit('tickets-ap-actualizados', {
        action: 'update',
        msg: `Ticket actualizado: ${actualizado.nombreTicket}`
      });

      return actualizado;
    });
  }

  async deleteTicket(codigoTicket) {
    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoTicket },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: 'No existe el ticket con ese ID para eliminar.' };

      const nombreTicket = registroDB.nombreTicket;

      await this.model.destroy({
        where: { codigoTicket },
        transaction: t
      });

      io.emit('tickets-ap-actualizados', {
        action: 'delete',
        msg: `Ticket eliminado: ${nombreTicket}`
      });

      return true;
    });
  }
}

module.exports = TicketAPService;