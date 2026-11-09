/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Audit Standards
*/
const { response } = require("express");
const TipoEstadoService = require("../services/tipos-estados.service");

const service = new TipoEstadoService();

const getTiposEstados = async (req, res = response) => {
  try {
    const tipos = await service.getTiposEstados();
    return res.status(200).json({ ok: true, tipos });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error interno al obtener los tipos de estado.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

const getTipoEstadoById = async (req, res = response) => {
  try {
    const { id } = req.params;
    const tipo = await service.getTipoEstadoById(id);
    return res.status(200).json({ ok: true, tipo });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al obtener el tipo de estado solicitado.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

const createTipoEstado = async (req, res = response) => {
  try {
    // QPLUS: Inyección de auditoría
    const usuarioAccion = req.codigoUsuario || 'SISTEMA'; // CC-137: del token (validarJWT)
    const dataDTO = { ...req.body, codigoUsuarioCreacion: usuarioAccion, codigoUsuarioModificacion: usuarioAccion };

    const tipo = await service.createTipoEstado(dataDTO);
    return res.status(201).json({ ok: true, tipo });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al crear el tipo de estado.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

const updateTipoEstado = async (req, res = response) => {
  try {
    const { id } = req.params;

    // QPLUS: Hidratación del payload de auditoría
    const usuarioAccion = req.codigoUsuario || 'SISTEMA'; // CC-137: del token (validarJWT)
    const dataDTO = { ...req.body, codigoUsuarioModificacion: usuarioAccion };

    const tipo = await service.updateTipoEstado(id, dataDTO);
    return res.status(200).json({ ok: true, tipo });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al actualizar el tipo de estado.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

const deleteTipoEstado = async (req, res = response) => {
  try {
    const { id } = req.params;
    await service.deleteTipoEstado(id);

    return res.status(200).json({
      ok: true,
      msg: "Tipo de estado eliminado correctamente."
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al eliminar el tipo de estado.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

module.exports = {
  getTiposEstados,
  getTipoEstadoById,
  createTipoEstado,
  updateTipoEstado,
  deleteTipoEstado
};