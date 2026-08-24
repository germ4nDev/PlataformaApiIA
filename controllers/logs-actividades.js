/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Audit Standards
*/
const { response } = require("express");
const LogsActividadService = require("../services/log-actividades.service");

const service = new LogsActividadService();

const getLogs = async (req, res = response) => {
  try {
    const logs = await service.getLogsActividades();
    return res.status(200).json({ ok: true, logs });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error interno al obtener el historial de logs."
    });
  }
};

const getLogById = async (req, res = response) => {
  try {
    const { id } = req.params;
    const log = await service.getLogActividadPorId(id);
    return res.status(200).json({ ok: true, log });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al obtener el log solicitado."
    });
  }
};

const createLog = async (req, res = response) => {
  try {
    // QPLUS: Para los logs, el contexto de quién ejecuta es la esencia del DTO
    const usuarioAccion = req.body?.codigoUsuarioCreacion || 'SISTEMA';
    const dataDTO = { ...req.body, codigoUsuario: usuarioAccion };

    const log = await service.createLogActividad(dataDTO);
    return res.status(201).json({ ok: true, log });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al registrar el log de actividad."
    });
  }
};

module.exports = {
  getLogs,
  getLogById,
  createLog
};