/*
    Author: German Valencia
    Pattern: PLATAFORMA Controller - Dominios de la plataforma (OT-012, migración 026)
    Ruta pública (sin JWT; la web la pide al arrancar, antes del login):
      GET /api/dominios/contexto?host=<dominio>   { tipo, dominio, codigoAplicacion, codigoSuite, rutaPortal, rutaInicio, marca }
    Respuesta: { ok: true, data }.
    Aplicaciones › gestión (CC-202), con JWT y sesión; guardar con ACT_APP_MODIFICAR:
      GET /api/dominios/aplicacion/:codigoAplicacion   { ok, dominios: ['porttos.co', 'www.porttos.co'] }
      PUT /api/dominios/aplicacion/:codigoAplicacion   body { dominios: [...] | 'a.co, www.a.co' } → { ok, dominios }
*/
const Dominios = require('../../services/dominios/dominios.service');
const { responderError } = require('../../helpers/errores.helper');
const { manejar } = require('../../helpers/controlador.helper');

const contexto = async (req, res) => {
  try {
    const data = await Dominios.contexto(req.query, { origin: req.header('origin'), referer: req.header('referer') });
    res.set('Cache-Control', 'public, max-age=60');
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return responderError(res, error, 'Dominios.contexto');
  }
};

const dominiosDeAplicacion = manejar('Dominios.deAplicacion', async (req, res) =>
  res.json({ ok: true, dominios: await Dominios.dominiosDeAplicacion(req.params) }));

const guardarDominiosDeAplicacion = manejar('Dominios.guardarDeAplicacion', async (req, res) =>
  res.json({ ok: true, dominios: await Dominios.guardarDominiosDeAplicacion(req.params, req.body) }));

module.exports = { contexto, dominiosDeAplicacion, guardarDominiosDeAplicacion };
