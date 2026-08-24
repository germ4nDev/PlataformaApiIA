/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Service Layer Sanitization & Transactional Integrity
*/
const { sequelize } = require("../database/connection");
const { TipoGaleriaModel, TipoGaleriaDTO } = require("../models/tipo-galeria");
const { io } = require("../index");

class TipoGaleriaService {
  constructor() {
    this.model = TipoGaleriaModel(sequelize);
  }

  async getTiposGaleria() {
    return await this.model.findAll();
  }

  async getTipoGaleriaById(codigoTipo) {
    const registro = await this.model.findOne({ where: { codigoTipo } });
    if (!registro) throw { statusCode: 404, msg: "No existe el tipo de galería solicitado." };
    return registro;
  }

  /**
   * Crea un nuevo tipo de galería
   */
  async createTipoGaleria(rawData) {
    const dataDTO = TipoGaleriaDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const nuevo = await this.model.create(dataDTO, { transaction: t });

      io.emit("tiposGaleria-actualizadas", {
        action: "create",
        msg: `Tipo de Galería creado: ${nuevo.nombreTipo || nuevo.nombreTipoGaleria}`,
      });

      return nuevo;
    });
  }

  /**
   * Actualiza un tipo de galería existente
   */
  async updateTipoGaleria(codigoTipo, rawData) {
    // El controlador inyecta el codigoUsuario en rawData antes de invocar este método
    const dataDTO = TipoGaleriaDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoTipo },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: "No existe el tipo de galería para actualizar." };

      await this.model.update(dataDTO, {
        where: { codigoTipo },
        transaction: t
      });

      const actualizado = await this.model.findOne({
        where: { codigoTipo },
        transaction: t
      });

      io.emit("tiposGaleria-actualizadas", {
        action: "update",
        msg: `Tipo de Galería actualizado: ${actualizado.nombreTipo || actualizado.nombreTipoGaleria}`,
      });

      return actualizado;
    });
  }

  async deleteTipoGaleria(codigoTipo) {
    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoTipo },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: "No existe el tipo de galería con ese ID para eliminar." };

      const nombreGaleria = registroDB.nombreTipo || registroDB.nombreTipoGaleria;

      await this.model.destroy({
        where: { codigoTipo },
        transaction: t
      });

      io.emit("tiposGaleria-actualizadas", {
        action: "delete",
        msg: `Tipo de Galería eliminado: ${nombreGaleria}`,
      });

      return true;
    });
  }
}

module.exports = TipoGaleriaService;