/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Service Layer Sanitization & Transactional Integrity
*/
const { sequelize } = require('../database/connection');
const { ClaseTicketModel, ClaseTicketDTO } = require('../models/clase-ticket');
const { io } = require('../index');

class ClasesTicketService {
  constructor() {
    this.model = ClaseTicketModel(sequelize);
  }

  async obtenerClasesTicket() {
    return await this.model.findAll();
  }

  async obtenerClaseTicketPorId(codigoClase) {
    const registro = await this.model.findOne({ where: { codigoClase } });
    if (!registro) throw { statusCode: 404, msg: "No existe la clase de ticket." };
    return registro;
  }

  async crearClaseTicket(rawData) {
    // El DTO sanitiza y estructura los datos antes de la transacción
    const dataDTO = ClaseTicketDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const nuevaClase = await this.model.create(dataDTO, { transaction: t });

      io.emit('clases-tickets-actualizadas', {
        action: 'create',
        msg: `Clase Ticket creada: ${nuevaClase.claseTicket}`
      });

      return nuevaClase;
    });
  }

  async actualizarClaseTicket(codigoClase, rawData) {
    // rawData debe venir con el codigoUsuario ya inyectado desde el controlador
    const dataDTO = ClaseTicketDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoClase },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: 'No existe la clase de ticket para actualizar.' };

      await this.model.update(dataDTO, {
        where: { codigoClase },
        transaction: t
      });

      const actualizado = await this.model.findOne({
        where: { codigoClase },
        transaction: t
      });

      io.emit('clases-tickets-actualizadas', {
        action: 'update',
        msg: `Clase Ticket actualizada: ${actualizado.claseTicket}`
      });

      return actualizado;
    });
  }

  async eliminarClaseTicket(codigoClase) {
    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoClase },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: 'No existe la clase de ticket para eliminar.' };

      await this.model.destroy({
        where: { codigoClase },
        transaction: t
      });

      io.emit('clases-tickets-actualizadas', {
        action: 'delete',
        msg: `Clase Ticket eliminada correctamente.`
      });

      return true;
    });
  }
}

module.exports = ClasesTicketService;