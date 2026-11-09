/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Error Handling
*/
const { response } = require("express");
const ColorSettingService = require("../services/colores-settings.service");

const service = new ColorSettingService();

const getColoresSettings = async (req, res = response) => {
  try {
    const coloresNav = await service.getColoresSettings();
    return res.status(200).json({ ok: true, coloresNav });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error interno al obtener configuraciones de color.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

const getColorSettingById = async (req, res = response) => {
  try {
    const { id } = req.params;
    const colorNav = await service.getColorSettingPorId(id);
    return res.status(200).json({ ok: true, colorNav });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al obtener la configuración de color.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

const createColorSetting = async (req, res = response) => {
  try {
    // QPLUS: Inyección de auditoría
    const dataDTO = { ...req.body };

    const colorNav = await service.createColorSetting(dataDTO);
    return res.status(201).json({ ok: true, colorNav });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al crear la configuración de color.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

const updateColorSetting = async (req, res = response) => {
  try {
    const { id } = req.params;

    // QPLUS: Hidratación del payload de auditoría
    const usuarioAccion = req.codigoUsuario || 'SISTEMA'; // CC-137: del token (validarJWT)
    const dataDTO = { ...req.body, codigoUsuarioModificacion: usuarioAccion };

    const colorNav = await service.updateColorSetting(id, dataDTO);
    return res.status(200).json({ ok: true, colorNav });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al actualizar la configuración de color.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

const deleteColorSetting = async (req, res = response) => {
  try {
    const { id } = req.params;
    await service.deleteColorSetting(id);

    return res.status(200).json({
      ok: true,
      msg: "Configuración eliminada correctamente."
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al eliminar la configuración de color.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

module.exports = {
  getColoresSettings,
  getColorSettingById,
  createColorSetting,
  updateColorSetting,
  deleteColorSetting
};