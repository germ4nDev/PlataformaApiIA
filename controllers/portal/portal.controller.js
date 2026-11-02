/*
    Author: German Valencia
    Pattern: PORTTOS Controller - Portal público porttos.co (migración 025, 2026-10-30)
    Rutas públicas (sin JWT, en routes/portal/portal.routes.js):
      GET  /api/portal/config                       correo de contacto, ruta del login de la plataforma y avisos
      GET  /api/portal/paginas/:pagina?idioma=es    inicio | solucion | planes | mision | contacto
      GET  /api/portal/planes                       planes, características y comparativo
      GET  /api/portal/preguntas/:pagina?idioma=es  preguntas frecuentes
      POST /api/portal/mensajes                     Contáctenos (también las solicitudes de acceso: no hay registro abierto)
      GET  /api/portal/puertos-en-vivo              puertos activos para el selector (OT-011)
      GET  /api/portal/puertos-en-vivo/:puerto      vías, tráfico, clima y marea: solo fuentes públicas, nunca simulados
    Respuesta: { ok: true, data }.
*/
const Portal = require('../../services/portal/portal.service');
const { responderError } = require('../../helpers/errores.helper');

const responder = (fn, contexto, estado = 200) => async (req, res) => {
  try {
    return res.status(estado).json({ ok: true, data: await fn(req) });
  } catch (error) {
    return responderError(res, error, contexto);
  }
};

module.exports = {
  config: responder(() => Portal.config(), 'Portal.config'),
  pagina: responder((req) => Portal.pagina(req.params, req.query), 'Portal.pagina'),
  planes: responder(() => Portal.planes(), 'Portal.planes'),
  preguntas: responder((req) => Portal.preguntas(req.params, req.query), 'Portal.preguntas'),
  mensaje: responder((req) => Portal.mensaje(req.body, req.ip), 'Portal.mensaje', 201),
  puertos: responder(() => Portal.puertos(), 'Portal.puertos'),
  puertoEnVivo: responder((req) => Portal.puertoEnVivo(req.params), 'Portal.puertoEnVivo'),
};
