/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Audit Standards
*/
const { response } = require("express");
const LogsTransaccionService = require("../services/log-transacciones.service");

const service = new LogsTransaccionService();

const getLogs = async (req, res = response) => {
  try {
    const logs = await service.getLogsTransacciones();
    return res.status(200).json({ ok: true, logs });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error interno al obtener los logs de transacciones."
    });
  }
};

const getLogById = async (req, res = response) => {
  try {
    const { id } = req.params;
    const log = await service.getLogTransaccionPorId(id);
    return res.status(200).json({ ok: true, log });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al obtener el log de transacción."
    });
  }
};

const createLog = async (req, res = response) => {
  try {
    // QPLUS: Inyección de contexto de auditoría (quién genera la transacción)
    const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';
    const dataDTO = { ...req.body, codigoUsuario: usuarioAccion };

    const log = await service.createLogTransaccion(dataDTO);
    return res.status(201).json({ ok: true, log });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al registrar el log de transacción."
    });
  }
};

module.exports = {
  getLogs,
  getLogById,
  createLog
};