const { sequelize } = require('../models'); // Ajusta a tu instancia de Sequelize

const validarPermiso = (permisoRequerido) => {
  return async (req, res, next) => {
    try {
      const codigoUsuario = req.usuario.codigoUsuario;
      console.log('*****************codigoUsuario validacion permisos', codigoUsuario);


      const codigoEmpresa = req.headers['x-empresa-id'];

      const query = `
                SELECT 1
                FROM PTLUsuariosRoles ur
                INNER JOIN PTLRoles r ON ur.codigoRole = r.codigoRole
                INNER JOIN PTLActividadesRoles ar ON r.codigoRole = ar.codigoRole
                INNER JOIN PTLActividades a ON ar.codigoActividad = a.codigoActividad
                WHERE ur.codigoUsuario = :codigoUsuario
                  AND a.llavePermiso = :permisoRequerido
                  AND ar.permiso = 1
                  AND a.estadoActividad = 1
                LIMIT 1;
            `;

      const [permisoEncontrado] = await sequelize.query(query, {
        replacements: { codigoUsuario, permisoRequerido },
        type: sequelize.QueryTypes.SELECT
      });

      if (!permisoEncontrado) {
        return res.status(403).json({
          ok: false,
          msg: `Acceso denegado. El usuario no posee el permiso: ${permisoRequerido}`
        });
      }

      next();

    } catch (error) {
      console.error('Error en el middleware de permisos:', error);
      res.status(500).json({ ok: false, msg: 'Error interno validando permisos de seguridad.' });
    }
  };
};

module.exports = { validarPermiso };