/*
    Author: German Valencia
    Pattern: PORTTOS Controller - Layout del teléfono (OT-017 fase 2)
    Rutas (JWT + sesión, en routes/layout-telefono/layout-telefono.routes.js); el usuario sale siempre del token:
      GET    /api/layout-telefono              pestañas con widgets de teléfono para el usuario
      GET    /api/layout-telefono/:pestana     layout del usuario (o el por defecto) + catálogo de disponibles
      PUT    /api/layout-telefono/:pestana     guarda { items: [{ codigo, x, y, cols, rows }] }
      DELETE /api/layout-telefono/:pestana     vuelve al por defecto
    Respuesta: { ok: true, data }.
*/
const LayoutTelefono = require('../../services/layout-telefono/layout-telefono.service');
const { responderError } = require('../../helpers/errores.helper');

const responder = (fn, contexto) => async (req, res) => {
  try {
    return res.status(200).json({ ok: true, data: await fn(req) });
  } catch (error) {
    return responderError(res, error, contexto);
  }
};

module.exports = {
  pestanas: responder((req) => LayoutTelefono.pestanas(req.codigoUsuario), 'LayoutTelefono.pestanas'),
  obtener: responder((req) => LayoutTelefono.obtener(req.codigoUsuario, req.params), 'LayoutTelefono.obtener'),
  guardar: responder((req) => LayoutTelefono.guardar(req.codigoUsuario, req.params, req.body), 'LayoutTelefono.guardar'),
  restablecer: responder((req) => LayoutTelefono.restablecer(req.codigoUsuario, req.params), 'LayoutTelefono.restablecer'),
};
