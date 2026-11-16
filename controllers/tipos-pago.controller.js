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

// CC-204 (Utilidades › Catálogos): obtener y escribir por capas (services/plataforma/catalogos.service.js: validación, código que no se
// repite ni cambia, no inactiva ni elimina lo que otras tablas usan, socket de siempre y catalogos-actualizados). Mismas rutas y
// permisos; la respuesta trae `registro` y conserva la forma anterior.
const Catalogo = require('./plataforma/catalogos.controller').para('tipos-pago', (r) => ({ respuesta: { msg: r } }));

module.exports = {
  getTiposPago,
  getTipoPagoById: Catalogo.obtener,
  createTipoPago: Catalogo.crear,
  updateTipoPago: Catalogo.modificar,
  deleteTipoPago: Catalogo.eliminar
};
