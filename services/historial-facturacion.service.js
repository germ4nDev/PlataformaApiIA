/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, MP Integration, Service Layer Sanitization, Transactional Integrity & Provisioning
*/
const { sequelize } = require('../database/connection');

// Modelos
const { HistorialFacturacionModel, HistorialFacturacionDTO } = require('../models/historial-facturacion');

// Servicios
const MercadoPagoService = require('../services/mercadopago.service');
const FacturacionService = require('./facturacion.service');

const { getIO } = require('../helpers/socket.helper');

class HistorialFacturacionService {
  constructor() {
    // Inicialización de modelos (Funciones fábrica)
    this.model = HistorialFacturacionModel(sequelize);

    // Servicios
    this.mpService = new MercadoPagoService();
    this.facturacionService = new FacturacionService();
  }

  // =========================================================================
  // CRUD BÁSICO
  // =========================================================================
  async getHistoriales(filtros = {}, esParaIA = false) {
    try {
      const queryOptions = { where: filtros };
      if (esParaIA) {
        queryOptions.attributes = ['codigoHistorial', 'codigoSuscriptor', 'numFactura', 'montoPagado', 'estadoPPago'];
      }
      return await this.model.findAll(queryOptions);
    } catch (error) {
      console.error("Error en HistorialFacturacionService:", error);
      throw error;
    }
  }

  async getHistorialById(codigoHistorial) {
    const registro = await this.model.findOne({ where: { codigoHistorial } });
    if (!registro) throw { statusCode: 404, msg: "No existe el historial solicitado." };
    return registro;
  }

  async createHistorial(rawData) {
    const dataDTO = HistorialFacturacionDTO(rawData);
    dataDTO.estadoPPago = false;

    return await sequelize.transaction(async (t) => {

      const existente = await this.model.findOne({
        where: { codigoHistorial: dataDTO.codigoHistorial },
        transaction: t
      });

      if (existente) {
        throw { statusCode: 400, msg: `El código ${dataDTO.codigoHistorial} ya está registrado.` };
      }

      const nuevoNumFactura = await this.facturacionService.obtenerProximoConsecutivo(
        dataDTO.codigoSuscriptor,
        t
      );

      dataDTO.numFactura = nuevoNumFactura;

      const nuevo = await this.model.create(dataDTO, { transaction: t });

      getIO().emit('facturacion-actualizada', {
        action: 'create',
        msg: `Factura pendiente creada: ${nuevo.numFactura}`
      });

      return nuevo;
    });
  }

  // =========================================================================
  // MÉTODO DEFINITIVO: PAGO EN LÍNEA (BRICKS)
  // =========================================================================
  async procesarYCrearHistorial(rawData, formData) {
    const dataDTO = HistorialFacturacionDTO(rawData);
    dataDTO.estadoPPago = true;

    return await sequelize.transaction(async (t) => {
      const [existente, existeFactura] = await Promise.all([
        this.model.findOne({ where: { codigoHistorial: dataDTO.codigoHistorial }, transaction: t }),
        this.model.findOne({ where: { numFactura: dataDTO.numFactura }, transaction: t })
      ]);

      if (existente) throw { statusCode: 400, msg: `El historial ${dataDTO.codigoHistorial} ya existe.` };
      if (existeFactura) throw { statusCode: 400, msg: `La factura ${dataDTO.numFactura} ya existe.` };

      const resultadoMP = await this.mpService.procesarPagoBrick(formData, dataDTO.codigoHistorial);

      if (resultadoMP.status === 'approved') {
        const nuevoNumFactura = await this.facturacionService.obtenerProximoConsecutivo(
          dataDTO.codigoSuscriptor,
          t
        );

        dataDTO.numFactura = nuevoNumFactura;

        const nuevo = await this.model.create(dataDTO, { transaction: t });

        getIO().emit('facturacion-actualizada', { action: 'create_and_paid', msg: `¡Pago exitoso!` });
        return { estado: 'APROBADO', historial: nuevo, detalleMP: resultadoMP };

      } else if (resultadoMP.status === 'in_process') {
        dataDTO.estadoPPago = false;
        const pendiente = await this.model.create(dataDTO, { transaction: t });
        return { estado: 'EN_PROCESO', historial: pendiente, detalleMP: resultadoMP };
      } else {
        throw { statusCode: 402, msg: "El pago fue rechazado por el banco.", detalle: resultadoMP.status_detail };
      }
    });
  }

  // =========================================================================
  // MÉTODO DEFINITIVO: PAGO MANUAL (EFECTIVO)
  // =========================================================================
  async createHistorialManual(rawData) {

    const dataDTO = HistorialFacturacionDTO(rawData);
    dataDTO.estadoPago = true;

    if (!dataDTO.codigoSuscriptor) {
      throw { statusCode: 400, msg: "El campo 'codigoSuscriptor' es obligatorgetIO()." };
    }

    return await sequelize.transaction(async (t) => {
      const nuevoNumFactura = await this.facturacionService.obtenerProximoConsecutivo(
        dataDTO.codigoSuscriptor,
        t
      );

      dataDTO.numFactura = nuevoNumFactura;

      const nuevo = await this.model.create(dataDTO, { transaction: t });

      getIO().emit('facturacion-actualizada', {
        action: 'create_manual',
        msg: `Factura manual registrada y aprobada: ${nuevo.numFactura}`
      });

      return nuevo;
    });
  }

  // =========================================================================
  // ACTUALIZACIÓN WEBHOOK Y CRUD
  // =========================================================================
  async updateHistorial(codigoHistorial, rawData) {
    const dataDTO = HistorialFacturacionDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({ where: { codigoHistorial }, transaction: t });
      if (!registroDB) throw { statusCode: 404, msg: "No existe el historial para actualizar." };

      await this.model.update(dataDTO, { where: { codigoHistorial }, transaction: t });
      const actualizado = await this.model.findOne({ where: { codigoHistorial }, transaction: t });

      // OT-030: la base del suscriptor ya no se clona al aprobar el pago; se crea al asignar el paquete (aprovisionamiento.service).

      getIO().emit('facturacion-actualizada', { action: 'update', msg: `Historial actualizado.` });
      return actualizado;
    });
  }

  async deleteHistorial(codigoHistorial) {
    return await sequelize.transaction(async (t) => {
      await this.model.destroy({ where: { codigoHistorial }, transaction: t });
      return true;
    });
  }
}

module.exports = HistorialFacturacionService;