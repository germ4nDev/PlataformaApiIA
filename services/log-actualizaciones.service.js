/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Immutable Audit Logs & Transactional Integrity
*/
const { sequelize } = require('../database/connection');
const { LogActualizacionModel, LogActualizacionDTO } = require('../models/log-actualizacion');
const { io } = require('../index');

class LogsActualizacionService {
  constructor() {
    this.model = LogActualizacionModel(sequelize);
  }

  /**
   * Obtiene el histórico de actualizaciones, del más reciente al más antiguo
   */
  async getLogsActualizaciones() {
    return await this.model.findAll({
      order: [['fechaCreacion', 'DESC']]
    });
  }

  async getLogActualizacionPorId(logId) {
    const registro = await this.model.findOne({ where: { logId } });
    if (!registro) throw { statusCode: 404, msg: "No existe el log de actualización solicitado." };
    return registro;
  }

  /**
   * Crea un registro de actualización inmutable
   */
  async createLogActualizacion(rawData) {
    const dataDTO = LogActualizacionDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const nuevoLog = await this.model.create(dataDTO, { transaction: t });

      io.emit('log-actualizaciones-actualizados', {
        action: 'create',
        msg: `Log de actualización registrado: ${nuevoLog.logId}`
      });

      return nuevoLog;
    });
  }
}

module.exports = LogsActualizacionService;