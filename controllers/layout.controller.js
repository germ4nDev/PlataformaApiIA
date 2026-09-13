/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Audit Standards
*/
const { response } = require("express");
const LayoutService = require("../services/layout.service");

const service = new LayoutService();

const getLayoutByUsuario = async (req, res = response) => {
  try {
    const { codigoUsuario } = req.params;
    const layout = await service.getLayoutByUsuario(codigoUsuario);

    return res.status(200).json({
      ok: true,
      layout: layout ? layout.layoutData : null,
      detalle: layout
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error interno al obtener el layout del usuario."
    });
  }
};

const saveOrUpdateLayout = async (req, res = response) => {
  try {
    const dataDTO = { ...req.body };
    const layoutGuardado = await service.saveOrUpdateLayout(dataDTO);

    return res.status(200).json({
      ok: true,
      msg: "Layout guardado exitosamente.",
      layout: layoutGuardado.layoutData
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al guardar el layout.",
      detalles: error.details || null
    });
  }
};

module.exports = {
  getLayoutByUsuario,
  saveOrUpdateLayout
};