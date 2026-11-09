/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Audit Standards
*/
const { response } = require("express");
const TextoIDService = require("../services/textos-id.service");

const service = new TextoIDService();

const getTextos = async (req, res = response) => {
  try {
    const textos = await service.getTextos();
    return res.status(200).json({ ok: true, textos });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error interno al obtener los textos.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

const getTextoById = async (req, res = response) => {
  try {
    const { id } = req.params;
    const texto = await service.getTextoById(id);
    return res.status(200).json({ ok: true, texto });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al obtener el texto solicitado.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

const createTexto = async (req, res = response) => {
  try {
    // QPLUS: Inyección de contexto de auditoría con fallback
    const usuarioAccion = req.codigoUsuario || 'SISTEMA'; // CC-137: del token (validarJWT)
    const dataDTO = { ...req.body, codigoUsuarioCreacion: usuarioAccion, codigoUsuarioModificacion: usuarioAccion };

    const texto = await service.createTexto(dataDTO);
    return res.status(201).json({ ok: true, texto });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al crear el texto.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

const updateTexto = async (req, res = response) => {
  try {
    const { id } = req.params;

    // QPLUS: Hidratación del payload de auditoría
    const usuarioAccion = req.codigoUsuario || 'SISTEMA'; // CC-137: del token (validarJWT)
    const dataDTO = { ...req.body, codigoUsuarioModificacion: usuarioAccion };

    const texto = await service.updateTexto(id, dataDTO);
    return res.status(200).json({ ok: true, texto });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al actualizar el texto.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

const deleteTexto = async (req, res = response) => {
  try {
    const { id } = req.params;
    await service.deleteTexto(id);

    return res.status(200).json({
      ok: true,
      msg: "Texto eliminado correctamente."
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al eliminar el texto.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

module.exports = {
  getTextos,
  getTextoById,
  createTexto,
  updateTexto,
  deleteTexto
};