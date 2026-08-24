/*
    Author: German Valencia
    Controller: Tipos de Pago
*/
const { response } = require('express');
const TiposPagoService = require('../services/tipos-pago.service');
const service = new TiposPagoService();

const getTiposPago = async (req, res = response) => {
  try {
    const resultado = await service.getTiposPago();

    return res.status(200).json({
      ok: true,
      respuesta: { msg: resultado }
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error al obtener los tipos de pago."
    });
  }
};

const getTipoPagoById = async (req, res = response) => {
  try {
    const { id } = req.params;
    const resultado = await service.getTipoPagoById(id);

    return res.status(200).json({
      ok: true,
      respuesta: { msg: resultado }
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error al obtener el tipo de pago."
    });
  }
};

const createTipoPago = async (req, res = response) => {
  try {
    const resultado = await service.createTipoPago(req.body);

    return res.status(201).json({
      ok: true,
      respuesta: { msg: resultado }
    });
  } catch (error) {
    if (error.type === 'ValidationError') {
      return res.status(400).json({
        ok: false,
        msg: "Error de validación de datos.",
        errores: error.details
      });
    }
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error al crear el tipo de pago."
    });
  }
};

const updateTipoPago = async (req, res = response) => {
  try {
    const { id } = req.params;
    const resultado = await service.updateTipoPago(id, req.body);

    return res.status(200).json({
      ok: true,
      respuesta: { msg: resultado }
    });
  } catch (error) {
    if (error.type === 'ValidationError') {
      return res.status(400).json({
        ok: false,
        msg: "Error de validación de datos.",
        errores: error.details
      });
    }
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error al actualizar el tipo de pago."
    });
  }
};

const deleteTipoPago = async (req, res = response) => {
  try {
    const { id } = req.params;
    const resultado = await service.deleteTipoPago(id);

    return res.status(200).json({
      ok: true,
      respuesta: { msg: resultado }
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error al eliminar el tipo de pago."
    });
  }
};

module.exports = {
  getTiposPago,
  getTipoPagoById,
  createTipoPago,
  updateTipoPago,
  deleteTipoPago
};