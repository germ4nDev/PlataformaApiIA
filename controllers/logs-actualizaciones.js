/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Audit Standards
*/
const { response } = require("express");
const LogsActualizacionService = require("../services/log-actualizaciones.service");

const service = new LogsActualizacionService();

const getLogs = async (req, res = response) => {
  try {
    const logs = await service.getLogsActualizaciones();
    return res.status(200).json({ ok: true, logs });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error interno al obtener los logs de actualización."
    });
  }
};

const getLogById = async (req, res = response) => {
  try {
    const { id } = req.params;
    const log = await service.getLogActualizacionPorId(id);
    return res.status(200).json({ ok: true, log });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al obtener el log de actualización."
    });
  }
};

const createLog = async (req, res = response) => {
  try {
    // QPLUS: Contexto de auditoría con fallback a SISTEMA
    const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';
    const dataDTO = { ...req.body, codigoUsuario: usuarioAccion };

    const log = await service.createLogActualizacion(dataDTO);
    return res.status(201).json({ ok: true, log });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al registrar el log de actualización."
    });
  }
};

module.exports = {
  getLogs,
  getLogById,
  createLog
};