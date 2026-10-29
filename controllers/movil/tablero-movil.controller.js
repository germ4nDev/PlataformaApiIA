/*
    Author: German Valencia
    Pattern: PORTTOS Controller - App móvil
    Rutas (JWT + sesión, en routes/movil/movil.routes.js):
      GET /api/movil/tablero/:puerto/:pestana?fresco=1   widgets de la pestaña según el layout del usuario en la web
                                                        (o el por defecto); el usuario sale siempre del token
    Respuesta: { ok: true, data }.
*/
const TableroMovil = require('../../services/movil/tablero-movil.service');
const { responderError } = require('../../helpers/errores.helper');

const responder = (fn, contexto) => async (req, res) => {
  try {
    return res.status(200).json({ ok: true, data: await fn(req) });
  } catch (error) {
    return responderError(res, error, contexto);
  }
};

module.exports = {
  obtenerTablero: responder((req) => TableroMovil.tablero(req.params, req.query, new Date(), req.codigoUsuario || null), 'Movil.tablero'),
};
