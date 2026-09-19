/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Service Layer Sanitization & Transactional Integrity
*/
const { sequelize } = require('../database/connection');
const { SuscriptorModel, SuscriptorDTO } = require('../models/suscriptor');
const { getIO } = require('../helpers/socket.helper');

class SuscriptoresService {
  constructor() {
    this.model = SuscriptorModel(sequelize);
  }

  async getSuscriptores() {
    return await this.model.findAll();
  }

  async getSuscriptorById(codigoSuscriptor) {
    const registro = await this.model.findOne({ where: { codigoSuscriptor } });
    if (!registro) throw { statusCode: 404, msg: "No existe el suscriptor solicitado." };
    return registro;
  }

  async createSuscriptor(rawData) {
    console.log('crear suscriptor', rawData);
    // const dataDTO = SuscriptorDTO(rawData);

    return await sequelize.transaction(async (t) => {
      // Optimización QPLUS: Ejecución en paralelo de validaciones independientes
      // const [existeIdentificacion, existeNombre] = await Promise.all([
      //   this.model.findOne({ where: { identificacionSuscriptor: dataDTO.identificacionSuscriptor }, transaction: t }),
      //   this.model.findOne({ where: { nombreSuscriptor: dataDTO.nombreSuscriptor }, transaction: t })
      // ]);

      // if (existeIdentificacion) throw { statusCode: 400, msg: "Ya existe un suscriptor con esa identificación." };
      // if (existeNombre) throw { statusCode: 400, msg: "Ya existe un suscriptor con ese nombre." };

      const nuevo = await this.model.create(rawData, { transaction: t });

      getIO().emit("suscriptores-actualizados", {
        action: "create",
        msg: `Suscriptor creado: ${nuevo.nombreSuscriptor}`
      });

      return nuevo;
    });
  }

  async updateSuscriptor(codigoSuscriptor, rawData) {
    // El controlador inyecta el codigoUsuario en rawData antes de invocar este método
    const dataDTO = SuscriptorDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoSuscriptor },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: "No existe el suscriptor para actualizar." };

      await this.model.update(dataDTO, {
        where: { codigoSuscriptor },
        transaction: t
      });

      const actualizado = await this.model.findOne({
        where: { codigoSuscriptor },
        transaction: t
      });

      getIO().emit('suscriptores-actualizados', {
        action: 'update',
        msg: `Suscriptor actualizado: ${actualizado.nombreSuscriptor}`
      });

      return actualizado;
    });
  }

  async deleteSuscriptor(codigoSuscriptor) {
    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoSuscriptor },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: "No existe el suscriptor con ese ID para eliminar." };

      const nombreSuscriptor = registroDB.nombreSuscriptor;

      await this.model.destroy({
        where: { codigoSuscriptor },
        transaction: t
      });

      getIO().emit('suscriptores-actualizados', {
        action: 'delete',
        msg: `Suscriptor eliminado: ${nombreSuscriptor}`
      });

      return true;
    });
  }
}

module.exports = SuscriptoresService;