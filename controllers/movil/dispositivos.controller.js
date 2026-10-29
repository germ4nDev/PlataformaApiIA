/*
    Author: German Valencia
    Pattern: PORTTOS Controller - Dispositivos y notificaciones push de la app móvil (fase 3)
    Rutas (JWT + sesión, en routes/movil/movil.routes.js):
      GET  /api/movil/dispositivos            dispositivos del usuario + estado de las notificaciones en el servidor
      POST /api/movil/dispositivos            { token, plataforma, puertos, severidadMinima, idioma } alta o actualización
      POST /api/movil/dispositivos/baja       { token } deja de recibir (al cerrar sesión o apagar las notificaciones)
      POST /api/movil/dispositivos/prueba     notificación de prueba al dispositivo de la sesión activa
    El usuario sale del token (contextoUsuario) y la sesión de x-sesion-id ya validada por validarSesion.
    Respuesta: { ok: true, data }.
*/
const Push = require('../../services/movil/push.service');
const { responderError } = require('../../helpers/errores.helper');
const { contextoUsuario } = require('../../helpers/controlador.helper');

const responder = (fn, contexto) => async (req, res) => {
  try {
    return res.status(200).json({ ok: true, data: await fn(req) });
  } catch (error) {
    return responderError(res, error, contexto);
  }
};

const quien = (req) => ({ ...contextoUsuario(req), codigoSesion: req.sesionContexto?.codigoSesion || req.header('x-sesion-id') || null });

module.exports = {
  misDispositivos: responder((req) => Push.misDispositivos(quien(req)), 'Movil.dispositivos'),
  registrar: responder((req) => Push.registrar(req.body, quien(req)), 'Movil.registrarDispositivo'),
  baja: responder((req) => Push.baja(req.body, quien(req)), 'Movil.bajaDispositivo'),
  probar: responder((req) => Push.probar(quien(req)), 'Movil.pruebaPush'),
};
