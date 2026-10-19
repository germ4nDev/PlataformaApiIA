const { response } = require("express");
const GnlTelemetriaService = require("../../services/torre-control/gnl-telemetria.service");

const { responderError } = require('../../helpers/errores.helper');
//const service = new GnlTelemetriaService();

const iniciarSimulador = async (req, res = response) => {
  try {
    const { id_puerto } = req.body; // Ej: 'CARTAGENA_SPEC'
    const resultado = await GnlTelemetriaService.iniciarSimulador(id_puerto);
    return res.status(200).json({ ok: true, ...resultado });
  } catch (error) {
    return responderError(res, error, 'gnl-telemetria.iniciarSimulador');
  }
};

const detenerSimulador = async (req, res = response) => {
  try {
    const resultado = await GnlTelemetriaService.detenerSimulador();
    return res.status(200).json({ ok: true, ...resultado });
  } catch (error) {
    return responderError(res, error, 'gnl-telemetria.detenerSimulador');
  }
};

const getHistorialFlujo = async (req, res = response) => {
  try {
    const { id_puerto } = req.params;
    const historial = await GnlTelemetriaService.obtenerHistorialFlujo(id_puerto);
    return res.status(200).json({ ok: true, historial });
  } catch (error) {
    return responderError(res, error, 'gnl-telemetria.getHistorialFlujo');
  }
};

module.exports = {
  iniciarSimulador,
  detenerSimulador,
  getHistorialFlujo
};