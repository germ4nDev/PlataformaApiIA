/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Error Handling
*/
const { response } = require("express");
const EnlaceSTService = require("../services/enlaces-st.service");

const service = new EnlaceSTService();

const getEnlaces = async (req, res = response) => {
  try {
    const enlaces = await service.getEnlaces();
    return res.status(200).json({ ok: true, enlaces });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error interno al obtener los enlaces.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

const getEnlaceById = async (req, res = response) => {
  try {
    const { id } = req.params;
    const enlace = await service.getEnlacePorId(id);
    return res.status(200).json({ ok: true, enlace });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al obtener el enlace solicitado.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

const createEnlace = async (req, res = response) => {
  try {
    // QPLUS: Inyección de auditoría
    const usuarioAccion = req.codigoUsuario || 'SISTEMA'; // CC-137: del token (validarJWT)
    const dataDTO = { ...req.body, codigoUsuarioCreacion: usuarioAccion, codigoUsuarioModificacion: usuarioAccion };

    const enlace = await service.createEnlace(dataDTO);
    return res.status(201).json({ ok: true, enlace });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al crear el enlace.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

const updateEnlace = async (req, res = response) => {
  try {
    const { id } = req.params;

    // QPLUS: Hidratación del payload
    const usuarioAccion = req.codigoUsuario || 'SISTEMA'; // CC-137: del token (validarJWT)
    const dataDTO = { ...req.body, codigoUsuarioModificacion: usuarioAccion };

    const enlace = await service.updateEnlace(id, dataDTO);
    return res.status(200).json({ ok: true, enlace });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al actualizar el enlace.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

const deleteEnlace = async (req, res = response) => {
  try {
    const { id } = req.params;
    await service.deleteEnlace(id);

    return res.status(200).json({
      ok: true,
      msg: "Enlace eliminado correctamente."
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al eliminar el enlace.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

module.exports = {
  getEnlaces,
  getEnlaceById,
  createEnlace,
  updateEnlace,
  deleteEnlace
};