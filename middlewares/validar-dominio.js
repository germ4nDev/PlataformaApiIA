/*
    Author: German Valencia
    Middleware global: validarDominio (OT-012, migración 026)
    Si la petición viene de un dominio de tipo 'aplicacion' (encabezado Origin o Referer) y trae token, el suscriptor del usuario debe
    tenerle asignada esa aplicación (paquetes activos; CC-145: el acceso lo da el suscriptor, los permisos los roles); si no, 403 DOMINIO_SIN_ACCESO. Consola, dominios sin registro y peticiones sin origen
    (app móvil, servidor a servidor, herramientas) siguen igual que hoy. Sin token no decide: cada ruta aplica su validarJWT.
    Exentas: /api/dominios (el contexto es público), /api/auth (el login devuelve el token; la web avisa y cierra si no hay
    acceso) y /api/sesiones (para poder cerrar la sesión). Si la base falla al consultar las aplicaciones → 503 (no deja pasar a ciegas).
*/
const jwt = require('jsonwebtoken');
const Dominios = require('../services/dominios/dominios.service');

const EXENTAS = /^\/api\/(dominios|auth|sesiones)(\/|$)/i;

const validarDominio = async (req, res, next) => {
  try {
    if (req.method === 'OPTIONS' || EXENTAS.test(req.path)) return next();
    const token = req.header('x-token');
    if (!token) return next();

    let codigoUsuario;
    try {
      ({ codigoUsuario } = jwt.verify(token, process.env.JWT_SECRET));
    } catch (_) {
      return next(); // token inválido: lo rechaza el validarJWT de la ruta, con su mensaje de siempre
    }

    const contexto = await Dominios.contextoDeOrigen(req.header('origin'), req.header('referer'));
    if (contexto.tipo !== 'aplicacion') return next();

    if (await Dominios.usuarioPuedeEntrar(contexto, codigoUsuario)) {
      req.contextoDominio = contexto;
      return next();
    }
    return res.status(403).json({
      ok: false,
      codigo: 'DOMINIO_SIN_ACCESO',
      msg: 'Su usuario no tiene acceso a esta aplicación desde este dominio.',
    });
  } catch (error) {
    console.error('❌ [Dominios] Error validando el acceso por dominio:', error?.message || error);
    return res.status(503).json({ ok: false, msg: 'No se pudo validar el acceso por dominio. Intente de nuevo.' });
  }
};

module.exports = { validarDominio };
