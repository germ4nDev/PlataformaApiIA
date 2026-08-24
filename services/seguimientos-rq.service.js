/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Service Layer Sanitization & Transactional Integrity
*/
const { sequelize } = require('../database/connection');
const { SeguimientoModel, SeguimientoDTO } = require('../models/seguimiento');
const { io } = require('../index');

class SeguimientosService {
  constructor() {
    this.model = SeguimientoModel(sequelize);
  }

  async getSeguimientos() {
    return await this.model.findAll();
  }

  async getSeguimientoById(codigoSeguimiento) {
    const registro = await this.model.findOne({ where: { codigoSeguimiento } });
    if (!registro) throw { statusCode: 404, msg: "No existe el seguimiento solicitado." };
    return registro;
  }

  async getSeguimientosByTicket(codigoTicket) {
    return await this.model.findAll({
      where: { codigoTicket },
      order: [['fechaCreacion', 'DESC']] // Historial del más reciente al más antiguo
    });
  }

  /**
   * Crea un nuevo registro de seguimiento para un ticket
   */
  async createSeguimiento(rawData) {
    const dataDTO = SeguimientoDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const nuevo = await this.model.create(dataDTO, { transaction: t });

      io.emit('seguimientos-tk-actualizados', {
        action: 'create',
        msg: `Seguimiento creado: ${nuevo.codigoSeguimiento}`
      });

      return nuevo;
    });
  }

  /**
   * Actualiza un seguimiento existente
   */
  async updateSeguimiento(codigoSeguimiento, rawData) {
    // El controlador inyecta el codigoUsuario en rawData antes de invocar este método
    const dataDTO = SeguimientoDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoSeguimiento },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: 'No existe el seguimiento para actualizar.' };

      await this.model.update(dataDTO, {
        where: { codigoSeguimiento },
        transaction: t
      });

      const actualizado = await this.model.findOne({
        where: { codigoSeguimiento },
        transaction: t
      });

      io.emit('seguimientos-tk-actualizados', {
        action: 'update',
        msg: `Seguimiento actualizado: ${actualizado.codigoSeguimiento}`
      });

      return actualizado;
    });
  }

  async deleteSeguimiento(codigoSeguimiento) {
    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoSeguimiento },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: 'No existe el seguimiento con ese ID para eliminar.' };

      const idEliminado = registroDB.codigoSeguimiento;

      await this.model.destroy({
        where: { codigoSeguimiento },
        transaction: t
      });

      io.emit('seguimientos-tk-actualizados', {
        action: 'delete',
        msg: `Seguimiento eliminado: ${idEliminado}`
      });

      return true;
    });
  }
}

module.exports = SeguimientosService;