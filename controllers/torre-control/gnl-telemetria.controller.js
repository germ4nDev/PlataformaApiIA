const { response } = require("express");
const GnlTelemetriaService = require("../../services/torre-control/gnl-telemetria.service");

const { responderError, validarCon } = require('../../helpers/errores.helper');
const { HistorialGnlQuerySchema } = require('../../models/torre-control/tableros-detalle.model');
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
    // Con ?horas=24|72|168 (vista ampliada) responde la serie por hora; sin él, las últimas 50 filas como antes
    const { horas } = validarCon(HistorialGnlQuerySchema, req.query);
    if (horas) return res.status(200).json({ ok: true, data: await GnlTelemetriaService.serieHistorial(String(id_puerto).toUpperCase(), horas) });
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