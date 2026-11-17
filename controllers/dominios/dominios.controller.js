/*
    Author: German Valencia
    Pattern: PLATAFORMA Controller - Dominios de la plataforma (OT-012, migración 026)
    Ruta pública (sin JWT; la web la pide al arrancar, antes del login):
      GET /api/dominios/contexto?host=<dominio>   { tipo, dominio, codigoAplicacion, codigoSuite, rutaPortal, rutaInicio, marca }
    Respuesta: { ok: true, data }.
    Aplicaciones › gestión (CC-202), con JWT y sesión; guardar con ACT_APP_MODIFICAR:
      GET /api/dominios/aplicacion/:codigoAplicacion   { ok, dominios: ['porttos.co', 'www.porttos.co'] }
      PUT /api/dominios/aplicacion/:codigoAplicacion   body { dominios: [...] | 'a.co, www.a.co' } → { ok, dominios }
    Utilidades › Dominios (CC-224), con JWT y sesión; escribir con ACT_DOM_*:
      GET    /api/dominios            { ok, dominios: [...] }          GET /api/dominios/:id   { ok, dominio }
      POST   /api/dominios            ACT_DOM_CREAR      → 201 { ok, dominio }
      PUT    /api/dominios/:id        ACT_DOM_MODIFICAR  → { ok, dominio }
      DELETE /api/dominios/:id        ACT_DOM_ELIMINAR   inactiva (nunca borra) → { ok, dominio }
    La auditoría sale del token (req.codigoUsuario).
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

// ---------- Utilidades › Dominios (CC-224) ----------
const listar = manejar('Dominios.listar', async (req, res) => res.json({ ok: true, dominios: await Dominios.listar() }));
const obtener = manejar('Dominios.obtener', async (req, res) => res.json({ ok: true, dominio: await Dominios.obtener(req.params) }));
const crear = manejar('Dominios.crear', async (req, res) => res.status(201).json({ ok: true, dominio: await Dominios.crear(req.body, req.codigoUsuario) }));
const modificar = manejar('Dominios.modificar', async (req, res) => res.json({ ok: true, dominio: await Dominios.modificar(req.params.id, req.body, req.codigoUsuario) }));
const eliminar = manejar('Dominios.eliminar', async (req, res) => res.json({ ok: true, dominio: await Dominios.eliminar(req.params, req.codigoUsuario) }));

module.exports = { contexto, dominiosDeAplicacion, guardarDominiosDeAplicacion, listar, obtener, crear, modificar, eliminar };
