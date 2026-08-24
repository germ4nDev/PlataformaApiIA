/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Service Layer Sanitization & Transactional Integrity
*/
const { sequelize } = require('../database/connection');
const { SitioAPModel, SitioAPDTO } = require('../models/sitio-ap');
const { io } = require('../index');

class SitioAPService {
  constructor() {
    this.model = SitioAPModel(sequelize);
  }

  async getSitios() {
    return await this.model.findAll();
  }

  async getSitioById(codigoSitio) {
    const registro = await this.model.findOne({ where: { codigoSitio } });
    if (!registro) throw { statusCode: 404, msg: "No existe el sitio solicitado." };
    return registro;
  }

  /**
   * Crea un nuevo sitio validando que el nombre no exista previamente
   */
  async createSitio(rawData) {
    const dataDTO = SitioAPDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const existeNombre = await this.model.findOne({
        where: { nombreSitio: dataDTO.nombreSitio },
        transaction: t
      });

      if (existeNombre) {
        throw { statusCode: 400, msg: 'Ya existe un sitio con ese nombre.' };
      }

      const nuevo = await this.model.create(dataDTO, { transaction: t });

      io.emit('sitios-ap-actualizados', {
        action: 'create',
        msg: `Sitio creado: ${nuevo.nombreSitio}`
      });

      return nuevo;
    });
  }

  /**
   * Actualiza un sitio existente
   */
  async updateSitio(codigoSitio, rawData) {
    // El controlador inyecta el codigoUsuario en rawData antes de invocar este método
    const dataDTO = SitioAPDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoSitio },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: 'No existe el sitio para actualizar.' };

      await this.model.update(dataDTO, {
        where: { codigoSitio },
        transaction: t
      });

      const actualizado = await this.model.findOne({
        where: { codigoSitio },
        transaction: t
      });

      io.emit('sitios-ap-actualizados', {
        action: 'update',
        msg: `Sitio actualizado: ${actualizado.nombreSitio}`
      });

      return actualizado;
    });
  }

  async deleteSitio(codigoSitio) {
    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoSitio },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: 'No existe el sitio con ese ID para eliminar.' };

      const nombreSitio = registroDB.nombreSitio;

      await this.model.destroy({
        where: { codigoSitio },
        transaction: t
      });

      io.emit('sitios-ap-actualizados', {
        action: 'delete',
        msg: `Sitio eliminado: ${nombreSitio}`
      });

      return true;
    });
  }
}

module.exports = SitioAPService;