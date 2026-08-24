/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Service Layer Sanitization & Transactional Integrity
*/
const { sequelize } = require('../database/connection');
const { VersionAPModel, VersionAPDTO } = require('../models/version-ap');
const { io } = require('../index');

class VersionesAPService {
  constructor() {
    this.model = VersionAPModel(sequelize);
  }

  async getVersionesAP() {
    return await this.model.findAll();
  }

  async getVersionAPById(codigoVersion) {
    const version = await this.model.findOne({
      where: { codigoVersion },
    });

    if (!version) {
      throw { statusCode: 404, msg: "No existe la versión solicitada." };
    }

    return version;
  }

  /**
   * Crea un nuevo registro de versión
   */
  async createVersionAP(rawData) {
    const dataDTO = VersionAPDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const nuevaVersion = await this.model.create(dataDTO, { transaction: t });

      io.emit("versiones-actualizados", {
        action: "create",
        msg: `Versión creada: ${nuevaVersion.nombreVersion}`
      });

      return nuevaVersion;
    });
  }

  /**
   * Actualiza una versión existente
   */
  async updateVersionAP(codigoVersion, rawData) {
    // El controlador inyecta la auditoría en rawData antes de invocar este método
    const dataDTO = VersionAPDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const versionDB = await this.model.findOne({
        where: { codigoVersion },
        transaction: t
      });

      if (!versionDB) {
        throw { statusCode: 404, msg: "No existe la versión para actualizar." };
      }

      await this.model.update(dataDTO, {
        where: { codigoVersion },
        transaction: t
      });

      const versionAPActualizada = await this.model.findOne({
        where: { codigoVersion },
        transaction: t
      });

      io.emit("versiones-actualizados", {
        action: "update",
        msg: `Versión actualizada: ${versionAPActualizada.nombreVersion}`
      });

      return versionAPActualizada;
    });
  }

  async deleteVersionAP(codigoVersion) {
    return await sequelize.transaction(async (t) => {
      const versionDB = await this.model.findOne({
        where: { codigoVersion },
        transaction: t
      });

      if (!versionDB) {
        throw { statusCode: 404, msg: "No existe la versión con ese ID para eliminar." };
      }

      const nombreVersionEliminada = versionDB.nombreVersion;

      const resultado = await this.model.destroy({
        where: { codigoVersion },
        transaction: t
      });

      io.emit("versiones-actualizados", {
        action: "delete",
        msg: `Versión eliminada: ${nombreVersionEliminada}`
      });

      return resultado;
    });
  }
}

module.exports = VersionesAPService;