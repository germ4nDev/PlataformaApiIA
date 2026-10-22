/*
    Author: German Valencia
    Pattern: PORTTOS Controller - Recorrido del mapa (modo reproducir)
    Rutas (con JWT, en routes/torre-control/recorrido-mapa.routes.js):
      GET /api/recorrido-mapa/:puerto?horas=24   trayectorias de naves y camiones + línea de tiempo
    Respuesta: { ok: true, data }. Sin la migración 012 responde 503 (MIGRACION_PENDIENTE).
*/
const RecorridoMapaService = require('../../services/torre-control/recorrido-mapa.service');
const { PuertoParamSchema, RecorridoQuerySchema } = require('../../models/torre-control/recorrido-mapa.model');
const { responderError, validarCon } = require('../../helpers/errores.helper');

const obtenerRecorrido = async (req, res) => {
  try {
    const { puerto } = validarCon(PuertoParamSchema, req.params);
    const opciones = validarCon(RecorridoQuerySchema, req.query);
    const data = await RecorridoMapaService.recorrido(puerto, opciones);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return responderError(res, error, 'RecorridoMapa.recorrido');
  }
};

module.exports = { obtenerRecorrido };
