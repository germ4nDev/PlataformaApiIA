/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Service Layer Sanitization & Transactional Integrity
*/
const { sequelize } = require('../database/connection');
const { TipoPagoModel, TipoPagoDTO } = require('../models/Tipo-pago');
const { getIO } = require('../helpers/socket.helper');

class TiposPagoService {
  constructor() {
    this.model = TipoPagoModel(sequelize);
  }

  async getTiposPago(filtros = {}, esParaIA = false) {
    try {
      const queryOptions = {
        where: filtros,
      };

      if (esParaIA) {
        queryOptions.attributes = [
          'codigoTipoPago',
          'nombreTipoPago',
          'descripcionTipo',
          'estadoTipo'
        ];
      }

      return await this.model.findAll(queryOptions);

    } catch (error) {
      console.error("Error en TiposPagoService:", error);
      throw error;
    }
  }

  async getTipoPagoById(codigoTipoPago) {
    const registro = await this.model.findOne({ where: { codigoTipoPago } });
    if (!registro) throw { statusCode: 404, msg: "No existe el tipo de pago solicitado." };
    return registro;
  }

  async createTipoPago(rawData) {
    const dataDTO = TipoPagoDTO(rawData);

    return await sequelize.transaction(async (t) => {
      // Validación en paralelo: que no se repita el código ni el nombre
      const [existente, existeNombre] = await Promise.all([
        this.model.findOne({ where: { codigoTipoPago: dataDTO.codigoTipoPago }, transaction: t }),
        this.model.findOne({ where: { nombreTipoPago: dataDTO.nombreTipoPago }, transaction: t })
      ]);

      if (existente) throw { statusCode: 400, msg: `El código ${dataDTO.codigoTipoPago} ya está registrado.` };
      if (existeNombre) throw { statusCode: 400, msg: `Ya existe un tipo de pago llamado ${dataDTO.nombreTipoPago}.` };

      const nuevo = await this.model.create(dataDTO, { transaction: t });

      getIO().emit('tipos-pago-actualizados', {
        action: 'create',
        msg: `Tipo de pago creado: ${nuevo.nombreTipoPago}`
      });

      return nuevo;
    });
  }

  async updateTipoPago(codigoTipoPago, rawData) {
    const dataDTO = TipoPagoDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoTipoPago },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: "No existe el tipo de pago para actualizar." };

      await this.model.update(dataDTO, {
        where: { codigoTipoPago },
        transaction: t
      });

      const actualizado = await this.model.findOne({
        where: { codigoTipoPago },
        transaction: t
      });

      getIO().emit('tipos-pago-actualizados', {
        action: 'update',
        msg: `Tipo de pago actualizado: ${actualizado.nombreTipoPago}`
      });

      return actualizado;
    });
  }

  async deleteTipoPago(codigoTipoPago) {
    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoTipoPago },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: "No existe el tipo de pago con ese código para eliminar." };

      const nombreTipoPago = registroDB.nombreTipoPago;

      await this.model.destroy({
        where: { codigoTipoPago },
        transaction: t
      });

      getIO().emit('tipos-pago-actualizados', {
        action: 'delete',
        msg: `Tipo de pago eliminado: ${nombreTipoPago}`
      });

      return true;
    });
  }
}

module.exports = TiposPagoService;