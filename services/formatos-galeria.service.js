/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Service Layer Sanitization & Transactional Integrity
*/
const { sequelize } = require("../database/connection");
const { FormatoGaleriaModel, FormatoGaleriaDTO } = require("../models/formato-galeria");
const { io } = require("../index");

class FormatoGaleriaService {
  constructor() {
    this.model = FormatoGaleriaModel(sequelize);
  }

  async getFormatosGaleria() {
    return await this.model.findAll();
  }

  async getFormatoGaleriaPorId(codigoFormato) {
    const registro = await this.model.findOne({ where: { codigoFormato } });
    if (!registro) throw { statusCode: 404, msg: "No existe el formato de galería solicitado." };
    return registro;
  }

  /**
   * Crea un nuevo formato validando nombre único
   */
  async createFormatoGaleria(rawData) {
    const dataDTO = FormatoGaleriaDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const existeNombre = await this.model.findOne({
        where: { nombreFormato: dataDTO.nombreFormato },
        transaction: t
      });

      if (existeNombre) throw { statusCode: 400, msg: 'Ya existe un formato con ese nombre.' };

      const formatoDB = await this.model.create(dataDTO, { transaction: t });

      io.emit("formatos-galeria-actualizadas", {
        action: "create",
        msg: `Formato de Galería creado: ${formatoDB.nombreFormato}`,
      });

      return formatoDB;
    });
  }

  /**
   * Actualiza un formato existente
   */
  async updateFormatoGaleria(codigoFormato, rawData) {
    // El controlador inyecta codigoUsuario en rawData antes de invocar este método
    const dataDTO = FormatoGaleriaDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoFormato },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: "No existe el formato de galería para actualizar." };

      await this.model.update(dataDTO, {
        where: { codigoFormato },
        transaction: t
      });

      const actualizado = await this.model.findOne({
        where: { codigoFormato },
        transaction: t
      });

      io.emit("formatos-galeria-actualizadas", {
        action: "update",
        msg: `Formato de Galería actualizado: ${actualizado.nombreFormato}`,
      });

      return actualizado;
    });
  }

  async deleteFormatoGaleria(codigoFormato) {
    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoFormato },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: "No existe el formato de galería para eliminar." };

      const nombreFormato = registroDB.nombreFormato;

      await this.model.destroy({
        where: { codigoFormato },
        transaction: t
      });

      io.emit("formatos-galeria-actualizadas", {
        action: "delete",
        msg: `Formato de Galería eliminado: ${nombreFormato}`,
      });

      return true;
    });
  }
}

module.exports = FormatoGaleriaService;