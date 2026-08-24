/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Service Layer Sanitization & Transactional Integrity
*/
const { sequelize } = require('../database/connection');
const { TipoLogModel, TipoLogDTO } = require('../models/tipo-log');
const { io } = require('../index');

class TipoLogService {
  constructor() {
    this.model = TipoLogModel(sequelize);
  }

  async getTiposLogs() {
    return await this.model.findAll();
  }

  async getTipoLogById(codigoTipoLog) {
    const registro = await this.model.findOne({ where: { codigoTipoLog } });
    if (!registro) throw { statusCode: 404, msg: "No existe el tipo de log solicitado." };
    return registro;
  }

  /**
   * Crea un nuevo tipo de log en el catálogo
   */
  async createTipoLog(rawData) {
    const dataDTO = TipoLogDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const nuevo = await this.model.create(dataDTO, { transaction: t });

      io.emit('tipos-logs-actualizados', {
        action: 'create',
        msg: `Tipo de Log creado: ${nuevo.nombreTipo || nuevo.nombreTipoLog}`
      });

      return nuevo;
    });
  }

  /**
   * Actualiza un tipo de log existente
   */
  async updateTipoLog(codigoTipoLog, rawData) {
    // El controlador inyecta el codigoUsuario en rawData antes de invocar este método
    const dataDTO = TipoLogDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoTipoLog },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: 'No existe el tipo de log para actualizar.' };

      await this.model.update(dataDTO, {
        where: { codigoTipoLog },
        transaction: t
      });

      const actualizado = await this.model.findOne({
        where: { codigoTipoLog },
        transaction: t
      });

      io.emit('tipos-logs-actualizados', {
        action: 'update',
        msg: `Tipo de Log actualizado: ${actualizado.nombreTipo || actualizado.nombreTipoLog}`
      });

      return actualizado;
    });
  }

  async deleteTipoLog(codigoTipoLog) {
    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoTipoLog },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: 'No existe el tipo de log con ese ID para eliminar.' };

      const nombreTipo = registroDB.nombreTipo || registroDB.nombreTipoLog;

      await this.model.destroy({
        where: { codigoTipoLog },
        transaction: t
      });

      io.emit('tipos-logs-actualizados', {
        action: 'delete',
        msg: `Tipo de Log eliminado: ${nombreTipo}`
      });

      return true;
    });
  }
}

module.exports = TipoLogService;