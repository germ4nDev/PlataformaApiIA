/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Error Handling
*/
const { response } = require("express");
const ContenidosELService = require("../services/contenidos-el.service");

const service = new ContenidosELService();

const getContenidos = async (req, res = response) => {
  try {
    const contenidos = await service.getContenidos();
    return res.status(200).json({ ok: true, contenidos });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error interno al obtener contenidos.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

const getContenidoByCode = async (req, res = response) => {
  try {
    const { id } = req.params;
    const contenido = await service.getContenidoByCode(id);
    return res.status(200).json({ ok: true, contenido });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al obtener el contenido solicitado.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

const createContenido = async (req, res = response) => {
  try {
    // QPLUS: Inyección de contexto de auditoría
    const usuarioAccion = req.codigoUsuario || 'SISTEMA'; // CC-137: del token (validarJWT)
    const dataDTO = { ...req.body, codigoUsuarioCreacion: usuarioAccion, codigoUsuarioModificacion: usuarioAccion };

    const contenidoDB = await service.createContenido(dataDTO);
    return res.status(201).json({ ok: true, contenidoDB });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al crear el contenido.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

const updateContenido = async (req, res = response) => {
  try {
    const { codigoContenido, ...data } = req.body;

    // QPLUS: Hidratación del payload de auditoría
    const usuarioAccion = req.codigoUsuario || 'SISTEMA'; // CC-137: del token (validarJWT)
    const dataDTO = { ...data, codigoUsuarioModificacion: usuarioAccion };

    const contenidoActualizado = await service.updateContenido(codigoContenido, dataDTO);
    return res.status(200).json({ ok: true, contenidoActualizado });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al actualizar el contenido.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

const deleteContenido = async (req, res = response) => {
  try {
    const { id } = req.params;
    await service.deleteContenido(id);

    return res.status(200).json({
      ok: true,
      msg: "Contenido eliminado correctamente."
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al eliminar el contenido.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

module.exports = {
  getContenidos,
  getContenidoByCode,
  createContenido,
  updateContenido,
  deleteContenido,
};