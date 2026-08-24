/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Service Layer Sanitization & Transactional Integrity
*/
const { sequelize } = require('../database/connection');
const { TipoPaqueteModel, TipoPaqueteDTO } = require('../models/TipoPaquete');
const { io } = require('../index');

class TiposPaqueteService {
  constructor() {
    this.model = TipoPaqueteModel(sequelize);
  }

  async getTiposPaquete(filtros = {}, esParaIA = false) {
    try {
      const queryOptions = {
        where: filtros,
      };

      if (esParaIA) {
        queryOptions.attributes = [
          'codigoTipoPaquete',
          'nombreTipoPaquete',
          'descripcionTipo',
          'estadoTipo'
        ];
      }

      return await this.model.findAll(queryOptions);

    } catch (error) {
      console.error("Error en TiposPaqueteService:", error);
      throw error;
    }
  }

  async getTipoPaqueteById(codigoTipoPaquete) {
    const registro = await this.model.findOne({ where: { codigoTipoPaquete } });
    if (!registro) throw { statusCode: 404, msg: "No existe el tipo de paquete solicitado." };
    return registro;
  }

  async createTipoPaquete(rawData) {
    const dataDTO = TipoPaqueteDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const [existente, existeNombre] = await Promise.all([
        this.model.findOne({ where: { codigoTipoPaquete: dataDTO.codigoTipoPaquete }, transaction: t }),
        this.model.findOne({ where: { nombreTipoPaquete: dataDTO.nombreTipoPaquete }, transaction: t })
      ]);

      if (existente) throw { statusCode: 400, msg: `El código ${dataDTO.codigoTipoPaquete} ya está registrado.` };
      if (existeNombre) throw { statusCode: 400, msg: `Ya existe un tipo de paquete llamado ${dataDTO.nombreTipoPaquete}.` };

      const nuevo = await this.model.create(dataDTO, { transaction: t });

      io.emit('tipos-paquete-actualizados', {
        action: 'create',
        msg: `Tipo de paquete creado: ${nuevo.nombreTipoPaquete}`
      });

      return nuevo;
    });
  }

  async updateTipoPaquete(codigoTipoPaquete, rawData) {
    const dataDTO = TipoPaqueteDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoTipoPaquete },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: "No existe el tipo de paquete para actualizar." };

      await this.model.update(dataDTO, {
        where: { codigoTipoPaquete },
        transaction: t
      });

      const actualizado = await this.model.findOne({
        where: { codigoTipoPaquete },
        transaction: t
      });

      io.emit('tipos-paquete-actualizados', {
        action: 'update',
        msg: `Tipo de paquete actualizado: ${actualizado.nombreTipoPaquete}`
      });

      return actualizado;
    });
  }

  async deleteTipoPaquete(codigoTipoPaquete) {
    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoTipoPaquete },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: "No existe el tipo de paquete con ese código para eliminar." };

      const nombreTipoPaquete = registroDB.nombreTipoPaquete;

      await this.model.destroy({
        where: { codigoTipoPaquete },
        transaction: t
      });

      io.emit('tipos-paquete-actualizados', {
        action: 'delete',
        msg: `Tipo de paquete eliminado: ${nombreTipoPaquete}`
      });

      return true;
    });
  }
}

module.exports = TiposPaqueteService;