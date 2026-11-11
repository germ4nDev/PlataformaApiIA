/*
    Author: German Valencia
    Pattern: PLATAFORMA Controller - Aprovisionamiento de bases por suscriptor (OT-030)
    Rutas (routes/aprovisionamientos.js):
      GET  /api/aprovisionamientos?codigoSuscriptor=   JWT + sesión: [{ codigoAplicacion, nombreAplicacion, nombreBD, estado, mensaje, version, intentos }]
      POST /api/aprovisionamientos/reintentar          ACT_SUSCPAQ_MODIFICAR  { codigoSuscriptor, codigoAplicacion }
*/
const Servicio = require('../../services/plataforma/aprovisionamiento.service');
const { manejar } = require('../../helpers/controlador.helper');

module.exports = {
  getAprovisionamientos: manejar('Aprovisionamiento.listar', async (req, res) => res.json({ ok: true, aprovisionamientos: await Servicio.listar(req.query) })),
  reintentar: manejar('Aprovisionamiento.reintentar', async (req, res) => res.json({ ok: true, aprovisionamiento: await Servicio.reintentar(req.body) })),
};
