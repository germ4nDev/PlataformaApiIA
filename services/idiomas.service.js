/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Service Layer Sanitization & Transactional Integrity
*/
const { sequelize } = require("../database/connection");
const { IdiomaModel, IdiomaDTO } = require("../models/idioma");
const { getIO } = require('../helpers/socket.helper');

// CC-208 (OT-036 fase 3): crear o activar un idioma en el maestro crea su archivo de traducción; si falla, Traducciones lo ofrece.
// CC-215: el archivo se crea con todas las llaves traducidas por la IA (en segundo plano; Traducciones y el portal muestran el avance).
const sincronizarTraducciones = () => { try { Promise.resolve(require('./plataforma/traducciones.service').sincronizarIdiomas()).catch(() => undefined); } catch { /* sin archivos */ } };

class IdiomaService {
  constructor() {
    this.model = IdiomaModel(sequelize);
  }

  async getIdiomas(filtros = {}, esParaIA = false) {
    try {
      const queryOptions = {
        where: filtros,
      };

      if (esParaIA) {
        queryOptions.attributes = [
          'nombreIdioma',
          'siglaIdioma',
          'translateKey',
          'estadoIdioma'
        ];
      }

      return await this.model.findAll(queryOptions);

    } catch (error) {
      console.error("Error en IdiomasService:", error);
      throw error;
    }
  }

  async getIdiomaPorId(codigoIdioma) {
    const registro = await this.model.findOne({ where: { codigoIdioma } });
    if (!registro) throw { statusCode: 404, msg: "No existe el idioma solicitado." };
    return registro;
  }

  /**
   * Crea un nuevo idioma en el catálogo
   */
  async createIdioma(rawData) {
    const dataDTO = IdiomaDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const idiomaDB = await this.model.create(dataDTO, { transaction: t });

      t.afterCommit(() => sincronizarTraducciones()); // CC-208/CC-215: el idioma nuevo tiene su archivo, traducido por la IA (después del commit: así lo ve)
      getIO().emit("idiomas-actualizados", {
        action: "create",
        msg: `Idioma creado: ${idiomaDB.nombreIdioma}`,
      });

      return idiomaDB;
    });
  }

  /**
   * Actualiza un idioma existente
   */
  async updateIdioma(codigoIdioma, rawData) {
    // El DTO inyecta los campos de auditoría (codigoUsuario) recibidos en rawData
    const dataDTO = IdiomaDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoIdioma },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: "No existe el idioma con ese ID para actualizar." };

      await this.model.update(dataDTO, {
        where: { codigoIdioma },
        transaction: t
      });

      const actualizado = await this.model.findOne({
        where: { codigoIdioma },
        transaction: t
      });

      t.afterCommit(() => sincronizarTraducciones()); // CC-208/CC-215: un idioma que se activa tiene su archivo, traducido por la IA
      getIO().emit("idiomas-actualizados", {
        action: "update",
        msg: `Idioma actualizado: ${actualizado.nombreIdioma}`,
      });

      return actualizado;
    });
  }

  async deleteIdioma(codigoIdioma) {
    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoIdioma },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: "No existe el idioma con ese ID para eliminar." };

      const nombreIdioma = registroDB.nombreIdioma;

      await this.model.destroy({
        where: { codigoIdioma },
        transaction: t
      });

      getIO().emit("idiomas-actualizados", {
        action: "delete",
        msg: `Idioma "${nombreIdioma}" eliminado correctamente.`,
      });

      return true;
    });
  }
}

module.exports = IdiomaService;