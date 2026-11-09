/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Error Handling
*/
const { response } = require("express");
const TipoLogService = require("../services/tipos-logs.service");

const service = new TipoLogService();

const getTiposLogs = async (req, res = response) => {
  try {
    const tipos = await service.getTiposLogs();
    return res.status(200).json({ ok: true, tipos });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error interno al obtener los tipos de log.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

const getTipoLogById = async (req, res = response) => {
  try {
    const { id } = req.params;
    const tipo = await service.getTipoLogById(id);
    return res.status(200).json({ ok: true, tipo });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al obtener el tipo de log solicitado.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

const createTipoLog = async (req, res = response) => {
  try {
    // QPLUS: Inyección de auditoría
    const usuarioAccion = req.codigoUsuario || 'SISTEMA'; // CC-137: del token (validarJWT)
    const dataDTO = { ...req.body, codigoUsuarioCreacion: usuarioAccion, codigoUsuarioModificacion: usuarioAccion };

    const tipo = await service.createTipoLog(dataDTO);
    return res.status(201).json({ ok: true, tipo });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al crear el tipo de log.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

const updateTipoLog = async (req, res = response) => {
  try {
    const { id } = req.params;

    // QPLUS: Hidratación del payload de auditoría
    const usuarioAccion = req.codigoUsuario || 'SISTEMA'; // CC-137: del token (validarJWT)
    const dataDTO = { ...req.body, codigoUsuarioModificacion: usuarioAccion };

    const tipo = await service.updateTipoLog(id, dataDTO);
    return res.status(200).json({ ok: true, tipo });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al actualizar el tipo de log.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

const deleteTipoLog = async (req, res = response) => {
  try {
    const { id } = req.params;
    await service.deleteTipoLog(id);

    return res.status(200).json({
      ok: true,
      msg: "Tipo de log eliminado correctamente."
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al eliminar el tipo de log.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

module.exports = {
  getTiposLogs,
  getTipoLogById,
  createTipoLog,
  updateTipoLog,
  deleteTipoLog
};