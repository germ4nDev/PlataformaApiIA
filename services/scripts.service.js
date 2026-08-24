/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Service Layer Sanitization & Transactional Integrity
*/
const { sequelize } = require("../database/connection");
const { ScriptModel, ScriptDTO } = require("../models/scripts");
const { io } = require("../index");

class ScriptsService {
  constructor() {
    this.model = ScriptModel(sequelize);
  }

  async getScripts() {
    return await this.model.findAll();
  }

  async getScriptById(codigoScript) {
    const registro = await this.model.findOne({ where: { codigoScript } });
    if (!registro) throw { statusCode: 404, msg: "No existe el script solicitado." };
    return registro;
  }

  /**
   * Crea un nuevo registro de script
   */
  async createScript(rawData) {
    const dataDTO = ScriptDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const nuevo = await this.model.create(dataDTO, { transaction: t });

      io.emit("scripts-actualizados", {
        action: "create",
        msg: `Script creado: ${nuevo.nombreScript}`
      });

      return nuevo;
    });
  }

  /**
   * Actualiza un registro de script existente
   */
  async updateScript(codigoScript, rawData) {
    // El controlador inyecta el codigoUsuario en rawData antes de invocar el servicio
    const dataDTO = ScriptDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoScript },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: "No existe el script para actualizar." };

      await this.model.update(dataDTO, {
        where: { codigoScript },
        transaction: t
      });

      const actualizado = await this.model.findOne({
        where: { codigoScript },
        transaction: t
      });

      io.emit("scripts-actualizados", {
        action: "update",
        msg: `Script actualizado: ${actualizado.nombreScript}`
      });

      return actualizado;
    });
  }

  async deleteScript(codigoScript) {
    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoScript },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: "No existe el script con ese ID para eliminar." };

      const nombreScript = registroDB.nombreScript;

      await this.model.destroy({
        where: { codigoScript },
        transaction: t
      });

      io.emit("scripts-actualizados", {
        action: "delete",
        msg: `Script eliminado: ${nombreScript}`
      });

      return true;
    });
  }
}

module.exports = ScriptsService;