/*
    Author: German Valencia
    Middleware: validarPermiso(llavePermiso, { propio }?)
    Deja pasar solo si el usuario está vinculado al suscriptor de la sesión (PTLUsuariosSC: codigoUsuario + codigoSuscriptor → codigoUsuarioSC)
    y alguno de los roles activos de ese vínculo en la empresa de la sesión (PTLUsuariosRole.codigoEmpresaSC) tiene la actividad con esa
    llavePermiso (PTLActividades) y permiso = 1. Va después de validarJWT (req.codigoUsuario) y de validarSesion (req.sesionContexto).
    Sin usuario → 401. Sin suscriptor o empresa en la sesión, sin vínculo o sin permiso → 403.
    { propio: (req) => codigoUsuario del recurso }: si es el mismo usuario de la sesión pasa sin permiso (p. ej. cambiar su propia clave).
    Corrección 2026-10-24: leía req.usuario (que nadie llena) y usaba LIMIT (no existe en SQL Server).
    Corrección 2026-11-07 (CC-128): el suscriptor llegaba undefined (Sequelize: «no entry in the replacement map»), la segunda consulta
    recibía el objeto { ok } como codigoUsuarioSC y filtraba PTLUsuariosRole por una columna que no tiene. Ahora una sola consulta.
*/
const { contextoPermiso, mensajeSinPermiso } = require('../utils/seguridad/permiso');
const { tienePermiso } = require('../repositories/plataforma/permisos.repository');

const validarPermiso = (permisoRequerido, opciones = {}) => {
  return async (req, res, next) => {
    try {
      const contexto = contextoPermiso(req, permisoRequerido, opciones);
      if (contexto.rechazo) {
        return res.status(contexto.rechazo.status).json({ ok: false, msg: contexto.rechazo.msg });
      }
      if (contexto.propio) return next();

      const permitido = await tienePermiso(contexto);
      if (!permitido) {
        return res.status(403).json({ ok: false, msg: mensajeSinPermiso(contexto.llavePermiso) });
      }

      next();
    } catch (error) {
      console.error('Error en el middleware de permisos:', error?.message || error);
      res.status(500).json({ ok: false, msg: 'Error interno validando permisos de seguridad.' });
    }
  };
};

module.exports = { validarPermiso };
