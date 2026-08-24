/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Immutable Audit Logs & Transactional Integrity
*/
const { sequelize } = require('../database/connection');
const { LogActividadModel, LogActividadDTO } = require('../models/log-actividad');
const { io } = require('../index');

class LogsActividadService {
  constructor() {
    this.model = LogActividadModel(sequelize);
  }

  /**
   * Recupera logs, por defecto ordenados por el más reciente
   */
  async getLogsActividades() {
    return await this.model.findAll({
      order: [['fechaCreacion', 'DESC']]
    });
  }

  async getLogActividadPorId(logId) {
    const registro = await this.model.findOne({ where: { logId } });
    if (!registro) throw { statusCode: 404, msg: "No existe el log de actividad solicitado." };
    return registro;
  }

  /**
   * Registra una nueva actividad. 
   * Nota: Este servicio es de escritura pura (inmutable).
   */
  async createLogActividad(rawData) {
    const dataDTO = LogActividadDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const nuevoLog = await this.model.create(dataDTO, { transaction: t });

      io.emit('log-actividades-actualizados', {
        action: 'create',
        msg: `Log de actividad registrado: ${nuevoLog.logId}`
      });

      return nuevoLog;
    });
  }
}

module.exports = LogsActividadService;