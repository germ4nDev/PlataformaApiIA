const { response } = require("express");
const GnlTelemetriaService = require("../../services/torre-control/gnl-telemetria.service");

const service = new GnlTelemetriaService();

const iniciarSimulador = async (req, res = response) => {
  try {
    const { id_puerto } = req.body; // Ej: 'CARTAGENA_SPEC'
    const resultado = await service.iniciarSimulador(id_puerto);
    return res.status(200).json({ ok: true, ...resultado });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ ok: false, msg: error.msg || "Error al iniciar simulador GNL." });
  }
};

const detenerSimulador = async (req, res = response) => {
  try {
    const resultado = await service.detenerSimulador();
    return res.status(200).json({ ok: true, ...resultado });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ ok: false, msg: error.msg || "Error al detener simulador." });
  }
};

const getHistorialFlujo = async (req, res = response) => {
  try {
    const { id_puerto } = req.params;
    const historial = await service.obtenerHistorialFlujo(id_puerto);
    return res.status(200).json({ ok: true, historial });
  } catch (error) {
    return res.status(500).json({ ok: false, msg: "Error al obtener el historial de flujo GNL." });
  }
};

module.exports = {
  iniciarSimulador,
  detenerSimulador,
  getHistorialFlujo
};