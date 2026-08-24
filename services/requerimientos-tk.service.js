/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Service Layer Sanitization & Transactional Integrity
*/
const { sequelize } = require('../database/connection');
const { RequerimientoModel, RequerimientoDTO } = require('../models/requerimiento');
const { io } = require('../index');

class RequerimientosService {
  constructor() {
    this.model = RequerimientoModel(sequelize);
  }

  async getRequerimientos() {
    return await this.model.findAll();
  }

  async getRequerimientoById(codigoRequerimiento) {
    const registro = await this.model.findOne({ where: { codigoRequerimiento } });
    if (!registro) throw { statusCode: 404, msg: "No existe el requerimiento solicitado." };
    return registro;
  }

  /**
   * Crea un nuevo requerimiento
   */
  async createRequerimiento(rawData) {
    const dataDTO = RequerimientoDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const nuevo = await this.model.create(dataDTO, { transaction: t });

      io.emit('requerimientos-actualizados', {
        action: 'create',
        msg: `Requerimiento creado: ${nuevo.nombreRequerimiento}`
      });

      return nuevo;
    });
  }

  /**
   * Actualiza un requerimiento existente
   */
  async updateRequerimiento(codigoRequerimiento, rawData) {
    // El controlador inyecta el codigoUsuario en rawData antes de invocar el servicio
    const dataDTO = RequerimientoDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoRequerimiento },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: 'No existe el requerimiento para actualizar.' };

      await this.model.update(dataDTO, {
        where: { codigoRequerimiento },
        transaction: t
      });

      const actualizado = await this.model.findOne({
        where: { codigoRequerimiento },
        transaction: t
      });

      io.emit('requerimientos-actualizados', {
        action: 'update',
        msg: `Requerimiento actualizado: ${actualizado.nombreRequerimiento}`
      });

      return actualizado;
    });
  }

  async deleteRequerimiento(codigoRequerimiento) {
    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoRequerimiento },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: 'No existe el requerimiento para eliminar.' };

      const nombreReq = registroDB.nombreRequerimiento;

      await this.model.destroy({
        where: { codigoRequerimiento },
        transaction: t
      });

      io.emit('requerimientos-actualizados', {
        action: 'delete',
        msg: `Requerimiento eliminado: ${nombreReq}`
      });

      return true;
    });
  }
}

module.exports = RequerimientosService;