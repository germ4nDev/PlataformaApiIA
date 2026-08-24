/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Service Layer Sanitization & Transactional Integrity
*/
const { sequelize } = require("../database/connection");
const { GaleriaModel, GaleriaDTO } = require("../models/galeria");
const { io } = require("../index");

class GaleriasService {
  constructor() {
    this.model = GaleriaModel(sequelize);
  }

  async getGalerias(filtros = {}, esParaIA = false) {
    try {
      const queryOptions = {
        where: filtros,
      };

      if (esParaIA) {
        queryOptions.attributes = [
          'nombreGaleria',
          'descripconGaleria',
          'estadoGaleria'
        ];
      }

      return await this.model.findAll(queryOptions);

    } catch (error) {
      console.error("Error en GaleriasService:", error);
      throw error;
    }
  }

  async getGaleriaPorId(codigoGaleria) {
    const registro = await this.model.findOne({ where: { codigoGaleria } });
    if (!registro) throw { statusCode: 404, msg: "No existe la galería solicitada." };
    return registro;
  }

  /**
   * Crea una nueva galería
   */
  async createGaleria(rawData) {
    const dataDTO = GaleriaDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const galeriaDB = await this.model.create(dataDTO, { transaction: t });

      io.emit("galerias-actualizadas", {
        action: "create",
        msg: `Galería creada: ${galeriaDB.nombreGaleria}`,
      });

      return galeriaDB;
    });
  }

  /**
   * Actualiza una galería existente
   */
  async updateGaleria(codigoGaleria, rawData) {
    // El controlador inyecta codigoUsuario en rawData antes de invocar este método
    const dataDTO = GaleriaDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoGaleria },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: "No existe la galería con ese ID para actualizar." };

      await this.model.update(dataDTO, {
        where: { codigoGaleria },
        transaction: t
      });

      const actualizado = await this.model.findOne({
        where: { codigoGaleria },
        transaction: t
      });

      io.emit("galerias-actualizadas", {
        action: "update",
        msg: `Galería actualizada: ${actualizado.nombreGaleria}`,
      });

      return actualizado;
    });
  }

  async deleteGaleria(codigoGaleria) {
    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoGaleria },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: "No existe la galería con ese ID para eliminar." };

      const nombreGaleria = registroDB.nombreGaleria;

      await this.model.destroy({
        where: { codigoGaleria },
        transaction: t
      });

      io.emit("galerias-actualizadas", {
        action: "delete",
        msg: `Galería "${nombreGaleria}" eliminada correctamente.`,
      });

      return true;
    });
  }
}

module.exports = GaleriasService;