/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Audit Standards
*/
const { response } = require("express");
const SeguimientosService = require("../services/seguimientos-rq.service");

const service = new SeguimientosService();

const getSeguimientos = async (req, res = response) => {
  try {
    const seguimientos = await service.getSeguimientos();
    return res.status(200).json({ ok: true, seguimientos });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error interno al obtener los seguimientos.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

const getSeguimientoById = async (req, res = response) => {
  try {
    const { id } = req.params;
    const seguimiento = await service.getSeguimientoById(id);
    return res.status(200).json({ ok: true, seguimiento });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al obtener el seguimiento solicitado.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

const getSeguimientosByTicket = async (req, res = response) => {
  try {
    const { ticketId } = req.params;
    const seguimientos = await service.getSeguimientosByTicket(ticketId);
    return res.status(200).json({ ok: true, seguimientos });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al obtener seguimientos por ticket.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

const createSeguimiento = async (req, res = response) => {
  try {
    // QPLUS: Inyección de contexto de auditoría con fallback
    const usuarioAccion = req.codigoUsuario || 'SISTEMA'; // CC-137: del token (validarJWT)
    const dataDTO = { ...req.body, codigoUsuarioCreacion: usuarioAccion, codigoUsuarioModificacion: usuarioAccion };

    const seguimiento = await service.createSeguimiento(dataDTO);
    return res.status(201).json({ ok: true, seguimiento });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al registrar el seguimiento.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

const updateSeguimiento = async (req, res = response) => {
  try {
    const { id } = req.params;

    // QPLUS: Hidratación del payload de auditoría
    const usuarioAccion = req.codigoUsuario || 'SISTEMA'; // CC-137: del token (validarJWT)
    const dataDTO = { ...req.body, codigoUsuarioModificacion: usuarioAccion };

    const seguimiento = await service.updateSeguimiento(id, dataDTO);
    return res.status(200).json({ ok: true, seguimiento });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al actualizar el seguimiento.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

const deleteSeguimiento = async (req, res = response) => {
  try {
    const { id } = req.params;
    await service.deleteSeguimiento(id);

    return res.status(200).json({
      ok: true,
      msg: "Seguimiento eliminado correctamente."
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al eliminar el seguimiento.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

module.exports = {
  getSeguimientos,
  getSeguimientoById,
  getSeguimientosByTicket,
  createSeguimiento,
  updateSeguimiento,
  deleteSeguimiento
};