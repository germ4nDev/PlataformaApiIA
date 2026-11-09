/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Error Handling
*/
const { response } = require("express");
const SitioAPService = require("../services/sitios-ap.service");

const service = new SitioAPService();

const getSitios = async (req, res = response) => {
  try {
    const sitios = await service.getSitios();
    return res.status(200).json({ ok: true, sitios });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error interno al obtener los sitios.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

const getSitioById = async (req, res = response) => {
  try {
    const { id } = req.params;
    const sitio = await service.getSitioById(id);
    return res.status(200).json({ ok: true, sitio });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al obtener el sitio solicitado.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

const createSitio = async (req, res = response) => {
  try {
    // QPLUS: Inyección de auditoría
    const usuarioAccion = req.codigoUsuario || 'SISTEMA'; // CC-137: del token (validarJWT)
    const dataDTO = { ...req.body, codigoUsuarioCreacion: usuarioAccion, codigoUsuarioModificacion: usuarioAccion };

    const sitio = await service.createSitio(dataDTO);
    return res.status(201).json({ ok: true, sitio });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al crear el sitio.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

const updateSitio = async (req, res = response) => {
  try {
    const { id } = req.params;

    // QPLUS: Hidratación del payload de auditoría
    const usuarioAccion = req.codigoUsuario || 'SISTEMA'; // CC-137: del token (validarJWT)
    const dataDTO = { ...req.body, codigoUsuarioModificacion: usuarioAccion };

    const sitio = await service.updateSitio(id, dataDTO);
    return res.status(200).json({ ok: true, sitio });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al actualizar el sitio.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

const deleteSitio = async (req, res = response) => {
  try {
    const { id } = req.params;
    await service.deleteSitio(id);

    return res.status(200).json({
      ok: true,
      msg: "Sitio eliminado correctamente."
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al eliminar el sitio.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

module.exports = {
  getSitios,
  getSitioById,
  createSitio,
  updateSitio,
  deleteSitio
};