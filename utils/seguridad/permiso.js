/*
    Author: German Valencia
    Núcleo puro de validarPermiso (AD-16, prueba en _pruebas/validar-permiso.test.js). CC-128.
    El permiso se valida contra los roles del vínculo usuario–suscriptor (PTL_UsuariosSC.codigoUsuarioSC) en la empresa de la sesión
    (PTL_UsuariosRole.codigoEmpresaSC), igual que la web arma el menú. Decisión del usuario (2026-11-07): solo se valida que el usuario de la
    sesión tenga la actividad; no se revisa a quién pertenece el registro destino.
    Sin usuario → 401; sin llave, sin suscriptor o sin empresa en la sesión → 403. Nunca devuelve undefined (Sequelize no lo acepta).
*/

const limpio = (valor) => (typeof valor === 'string' && valor.trim() ? valor.trim() : null);

const deSesion = (sesion, campo) => limpio(sesion?.[campo] ?? sesion?.dataValues?.[campo]);

/**
 * Saca de la petición lo que necesita la validación.
 * codigoUsuario lo deja validarJWT; codigoSuscriptor y codigoEmpresaSC, validarSesion en req.sesionContexto (PTL_Sesiones).
 * opciones.propio(req) → código del usuario dueño del recurso: si es el mismo de la sesión, pasa sin consultar (p. ej. su propia clave).
 */
function contextoPermiso(req = {}, llavePermiso, opciones = {}) {
  const codigoUsuario = limpio(req.codigoUsuario);
  const codigoSuscriptor = deSesion(req.sesionContexto, 'codigoSuscriptor');
  const codigoEmpresaSC = deSesion(req.sesionContexto, 'codigoEmpresaSC');
  const llave = limpio(llavePermiso);

  let propio = false;
  if (codigoUsuario && typeof opciones.propio === 'function') {
    try { propio = limpio(opciones.propio(req)) === codigoUsuario; } catch { propio = false; }
  }

  let rechazo = null;
  if (!codigoUsuario) {
    rechazo = { status: 401, msg: 'No hay usuario autenticado en la petición.' };
  } else if (propio) {
    rechazo = null;
  } else if (!llave) {
    rechazo = { status: 403, msg: 'Acceso denegado: la ruta no define el permiso requerido.' };
  } else if (!codigoSuscriptor) {
    rechazo = { status: 403, msg: `Acceso denegado. La sesión no tiene un suscriptor activo para validar el permiso ${llave}.` };
  } else if (!codigoEmpresaSC) {
    rechazo = { status: 403, msg: `Acceso denegado. La sesión no tiene una empresa activa para validar el permiso ${llave}.` };
  }
  return { codigoUsuario, codigoSuscriptor, codigoEmpresaSC, llavePermiso: llave, propio, rechazo };
}

const mensajeSinPermiso = (llavePermiso) =>
  `Acceso denegado. El usuario no posee el permiso ${llavePermiso} en la empresa activa.`;

module.exports = { contextoPermiso, mensajeSinPermiso };
