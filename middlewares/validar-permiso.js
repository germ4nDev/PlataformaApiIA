/*
    Author: German Valencia
    Middleware: validarPermiso(llavePermiso)
    Deja pasar si alguno de los roles del usuario tiene la actividad con esa llavePermiso (PTLActividades) y permiso = 1.
    Va después de validarJWT, que deja el usuario en req.codigoUsuario.
    Corrección 2026-10-24: leía req.usuario (que nadie llena) y usaba LIMIT (no existe en SQL Server): fallaba siempre con 500.
*/
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const validarPermiso = (permisoRequerido) => {
  return async (req, res, next) => {
    try {
      const codigoUsuario = req.codigoUsuario || req.usuario?.codigoUsuario;
      if (!codigoUsuario) {
        return res.status(401).json({ ok: false, msg: 'No hay usuario autenticado en la petición.' });
      }

      const [permisoEncontrado] = await sequelize.query(`
        SELECT TOP (1) 1 AS ok
        FROM PTLUsuariosRoles ur
        INNER JOIN PTLRoles r ON ur.codigoRole = r.codigoRole
        INNER JOIN PTLActividadesRoles ar ON r.codigoRole = ar.codigoRole
        INNER JOIN PTLActividades a ON ar.codigoActividad = a.codigoActividad
        WHERE ur.codigoUsuario = :codigoUsuario
          AND a.llavePermiso = :permisoRequerido
          AND ar.permiso = 1
          AND a.estadoActividad = 1`, {
        replacements: { codigoUsuario, permisoRequerido },
        type: QueryTypes.SELECT
      });

      if (!permisoEncontrado) {
        return res.status(403).json({
          ok: false,
          msg: `Acceso denegado. El usuario no posee el permiso: ${permisoRequerido}`
        });
      }

      next();

    } catch (error) {
      console.error('Error en el middleware de permisos:', error?.message || error);
      res.status(500).json({ ok: false, msg: 'Error interno validando permisos de seguridad.' });
    }
  };
};

module.exports = { validarPermiso };
