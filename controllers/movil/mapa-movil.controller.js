/*
    Author: German Valencia
    Pattern: PORTTOS Controller - Mapa logístico de la app móvil (fase 4)
    Rutas (JWT + sesión, en routes/movil/movil.routes.js):
      GET /api/movil/mapa/:puerto     naves, camiones y eventos viales del puerto en un solo paquete liviano
    Respuesta: { ok: true, data }.
*/
const MapaMovil = require('../../services/movil/mapa-movil.service');
const { responderError } = require('../../helpers/errores.helper');

const responder = (fn, contexto) => async (req, res) => {
  try {
    return res.status(200).json({ ok: true, data: await fn(req) });
  } catch (error) {
    return responderError(res, error, contexto);
  }
};

module.exports = {
  obtenerMapa: responder((req) => MapaMovil.mapa(req.params), 'Movil.mapa'),
};
