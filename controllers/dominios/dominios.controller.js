/*
    Author: German Valencia
    Pattern: PLATAFORMA Controller - Dominios de la plataforma (OT-012, migración 026)
    Ruta pública (sin JWT; la web la pide al arrancar, antes del login):
      GET /api/dominios/contexto?host=<dominio>   { tipo, dominio, codigoAplicacion, codigoSuite, rutaPortal, rutaInicio, marca }
    Respuesta: { ok: true, data }.
*/
const Dominios = require('../../services/dominios/dominios.service');
const { responderError } = require('../../helpers/errores.helper');

const contexto = async (req, res) => {
  try {
    const data = await Dominios.contexto(req.query, { origin: req.header('origin'), referer: req.header('referer') });
    res.set('Cache-Control', 'public, max-age=60');
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return responderError(res, error, 'Dominios.contexto');
  }
};

module.exports = { contexto };
