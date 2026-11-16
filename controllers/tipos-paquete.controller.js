/*
    Author: German Valencia
    Controller: Tipos de Paquete
*/
const { response } = require('express');
const TiposPaqueteService = require('../services/tipos-paquete.service');
const service = new TiposPaqueteService();

const getTiposPaquete = async (req, res = response) => {
  try {
    const resultado = await service.getTiposPaquete();

    return res.status(200).json({
      ok: true,
      respuesta: { msg: resultado }
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error al obtener los tipos de paquete."
    });
  }
};

const getTipoPaqueteById = async (req, res = response) => {
  try {
    const { id } = req.params;
    const resultado = await service.getTipoPaqueteById(id);

    return res.status(200).json({
      ok: true,
      respuesta: { msg: resultado }
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error al obtener el tipo de paquete."
    });
  }
};

const createTipoPaquete = async (req, res = response) => {
  try {
    const resultado = await service.createTipoPaquete(req.body);

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
      msg: error.msg || "Error al crear el tipo de paquete."
    });
  }
};

const updateTipoPaquete = async (req, res = response) => {
  try {
    const { id } = req.params;
    const resultado = await service.updateTipoPaquete(id, req.body);

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
      msg: error.msg || "Error al actualizar el tipo de paquete."
    });
  }
};

const deleteTipoPaquete = async (req, res = response) => {
  try {
    const { id } = req.params;
    const resultado = await service.deleteTipoPaquete(id);

    return res.status(200).json({
      ok: true,
      respuesta: { msg: resultado }
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error al eliminar el tipo de paquete."
    });
  }
};

// CC-204 (Utilidades › Catálogos): obtener y escribir por capas (services/plataforma/catalogos.service.js: validación, código que no se
// repite ni cambia, no inactiva ni elimina lo que otras tablas usan, socket de siempre y catalogos-actualizados). Mismas rutas y
// permisos; la respuesta trae `registro` y conserva la forma anterior.
const Catalogo = require('./plataforma/catalogos.controller').para('tipos-paquete', (r) => ({ respuesta: { msg: r } }));

module.exports = {
  getTiposPaquete,
  getTipoPaqueteById: Catalogo.obtener,
  createTipoPaquete: Catalogo.crear,
  updateTipoPaquete: Catalogo.modificar,
  deleteTipoPaquete: Catalogo.eliminar
};
