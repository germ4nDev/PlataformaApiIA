/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Service Layer Sanitization & Transactional Integrity
*/
const { sequelize } = require('../database/connection');
const { EnlaceSTModel, EnlaceSTDTO } = require('../models/enlace-st');
const { io } = require('../index');

class EnlaceSTService {
  constructor() {
    this.model = EnlaceSTModel(sequelize);
  }

  async getEnlaces() {
    return await this.model.findAll();
  }

  async getEnlacePorId(codigoEnlace) {
    const registro = await this.model.findOne({ where: { codigoEnlace } });
    if (!registro) throw { statusCode: 404, msg: "No existe el enlace solicitado." };
    return registro;
  }

  /**
   * Crea un nuevo enlace validando duplicidad de nombre
   */
  async createEnlace(rawData) {
    const dataDTO = EnlaceSTDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const existeNombre = await this.model.findOne({
        where: { nombreEnlace: dataDTO.nombreEnlace },
        transaction: t
      });

      if (existeNombre) {
        throw { statusCode: 400, msg: 'Ya existe un enlace con ese nombre.' };
      }

      const enlaceDB = await this.model.create(dataDTO, { transaction: t });

      io.emit('enlaces-st-actualizadas', {
        action: 'create',
        msg: `Enlace ST creado: ${enlaceDB.nombreEnlace}`
      });

      return enlaceDB;
    });
  }

  /**
   * Actualiza un enlace existente
   */
  async updateEnlace(codigoEnlace, rawData) {
    // El controlador debe inyectar codigoUsuario en rawData
    const dataDTO = EnlaceSTDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoEnlace },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: 'No existe un enlace con ese ID para update.' };

      await this.model.update(dataDTO, {
        where: { codigoEnlace },
        transaction: t
      });

      const actualizado = await this.model.findOne({
        where: { codigoEnlace },
        transaction: t
      });

      io.emit('enlaces-st-actualizadas', {
        action: 'update',
        msg: `Enlace ST actualizado: ${actualizado.nombreEnlace}`
      });

      return actualizado;
    });
  }

  async deleteEnlace(codigoEnlace) {
    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoEnlace },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: 'No existe un enlace con ese ID para delete.' };

      const nombreEnlace = registroDB.nombreEnlace;

      await this.model.destroy({
        where: { codigoEnlace },
        transaction: t
      });

      io.emit('enlaces-st-actualizadas', {
        action: 'delete',
        msg: `Enlace ST eliminado: ${nombreEnlace}`
      });

      return true;
    });
  }
}

module.exports = EnlaceSTService;