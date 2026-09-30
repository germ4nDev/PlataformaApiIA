/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Audit Standards
*/
const { response } = require("express");
const LayoutService = require("../services/layout.service");

const service = new LayoutService();

// --- CONTROLADORES WIDGETS ---
const getLayouts = async (req, res = response) => {
  try {
    const layouts = await service.getLayouts();
    return res.status(200).json({ ok: true, layout: layouts });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false, msg: error.msg || "Error interno al obtener los layouts."
    });
  }
};

const getLayoutByUsuario = async (req, res = response) => {
  try {
    const { codigoUsuario, codigoPestana } = req.params;
    const layouts = await service.getLayoutByUsuario(codigoUsuario, codigoPestana);
    return res.status(200).json({ ok: true, layout: layouts });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false, msg: error.msg || "Error interno al obtener el layout del usuario."
    });
  }
};

const saveOrUpdateLayout = async (req, res = response) => {
  try {
    const layoutGuardado = await service.saveLayout(req.body);
    return res.status(200).json({
      ok: true, msg: "Layout guardado exitosamente.", layout: layoutGuardado
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false, msg: error.msg || "Error al guardar el layout.", detalles: error.details || null
    });
  }
};

// --- CONTROLADORES PESTAÑAS ---
const getPestanasUsuario = async (req, res = response) => {
  try {
    const { codigoUsuario } = req.params;
    const pestanas = await service.getPestanasByUsuario(codigoUsuario);
    return res.status(200).json({ ok: true, data: pestanas });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false, msg: error.msg || "Error interno al obtener pestañas del usuario."
    });
  }
};

const savePestanasUsuario = async (req, res = response) => {
  try {
    const pestanasGuardadas = await service.savePestanasUsuario(req.body);
    return res.status(200).json({
      ok: true, msg: "Preferencias de pestañas guardadas.", data: pestanasGuardadas
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false, msg: error.msg || "Error al guardar pestañas.", detalles: error.details || null
    });
  }
};

module.exports = {
  getLayouts,
  getLayoutByUsuario,
  saveOrUpdateLayout,
  getPestanasUsuario,
  savePestanasUsuario
};