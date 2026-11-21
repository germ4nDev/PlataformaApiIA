/*
    Author: German Valencia
    Repositorio de permisos (CC-128): ¿el vínculo del usuario con el suscriptor (PTL_UsuariosSC.codigoUsuarioSC) tiene, por alguno de sus
    roles activos en la empresa de la sesión (PTL_UsuariosRole.codigoEmpresaSC), la actividad con esa llavePermiso y permiso = 1? Solo lectura.
*/
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../../database/connection');

const CONSULTA_PERMISO = `
  SELECT TOP (1) 1 AS ok
  FROM dbo.PTL_UsuariosSC u
  INNER JOIN dbo.PTL_UsuariosRole ur ON ur.codigoUsuarioSC = u.codigoUsuarioSC AND ISNULL(ur.estadoUsuarioRole, 1) = 1
                                 AND ur.codigoEmpresaSC = :codigoEmpresaSC
  INNER JOIN dbo.PTL_RolesAP r ON r.codigoRole = ur.codigoRole AND ISNULL(r.estadoRole, 1) = 1
  INNER JOIN dbo.PTL_ActividadesRoles ar ON ar.codigoRole = r.codigoRole AND ar.permiso = 1
  INNER JOIN dbo.PTL_Actividades a ON a.codigoActividad = ar.codigoActividad AND a.estadoActividad = 1
  WHERE u.codigoUsuario = :codigoUsuario
    AND u.codigoSuscriptor = :codigoSuscriptor
    AND ISNULL(u.estadoUsuarioSC, 1) = 1
    AND a.llavePermiso = :llavePermiso`;

async function tienePermiso({ codigoUsuario, codigoSuscriptor, codigoEmpresaSC, llavePermiso }) {
  const filas = await sequelize.query(CONSULTA_PERMISO, {
    replacements: { codigoUsuario, codigoSuscriptor, codigoEmpresaSC, llavePermiso },
    type: QueryTypes.SELECT
  });
  return filas.length > 0;
}

/**
 * Roles activos del usuario en la empresa de la sesión, de una aplicación (CC-243, OT-037 paso 2). Contrato del módulo «permisos»
 * para las apps (regla 27): así una app segmenta por rol sus propias tablas sin JOIN con PTL_ (regla 26). Solo lectura.
 * @returns {Promise<string[]>} codigoRole
 */
const CONSULTA_ROLES = `
  SELECT DISTINCT r.codigoRole
  FROM dbo.PTL_UsuariosSC u
  INNER JOIN dbo.PTL_UsuariosRole ur ON ur.codigoUsuarioSC = u.codigoUsuarioSC AND ISNULL(ur.estadoUsuarioRole, 1) = 1
                                 AND ur.codigoEmpresaSC = :codigoEmpresaSC
  INNER JOIN dbo.PTL_RolesAP r ON r.codigoRole = ur.codigoRole AND ISNULL(r.estadoRole, 1) = 1
  WHERE u.codigoUsuario = :codigoUsuario
    AND u.codigoSuscriptor = :codigoSuscriptor
    AND ISNULL(u.estadoUsuarioSC, 1) = 1
    AND r.codigoAplicacion = :codigoAplicacion`;

async function rolesDelUsuario({ codigoUsuario, codigoSuscriptor, codigoEmpresaSC, codigoAplicacion }) {
  if (!codigoUsuario || !codigoSuscriptor || !codigoEmpresaSC) return [];
  const filas = await sequelize.query(CONSULTA_ROLES, {
    replacements: { codigoUsuario, codigoSuscriptor, codigoEmpresaSC, codigoAplicacion },
    type: QueryTypes.SELECT
  });
  return filas.map((f) => String(f.codigoRole));
}

/**
 * Usuarios que tienen una actividad por alguno de sus roles activos, en cualquier empresa (CC-250: a quién avisar una alerta escalada,
 * ACT_ALERTAS_SUPERVISAR). Contrato del módulo «permisos» para las apps (regla 27). Solo lectura.
 * @returns {Promise<string[]>} codigoUsuario
 */
async function usuariosConPermiso(llavePermiso) {
  const filas = await sequelize.query(`
    SELECT DISTINCT u.codigoUsuario
    FROM dbo.PTL_UsuariosSC u
    INNER JOIN dbo.PTL_UsuariosRole ur ON ur.codigoUsuarioSC = u.codigoUsuarioSC AND ISNULL(ur.estadoUsuarioRole, 1) = 1
    INNER JOIN dbo.PTL_RolesAP r ON r.codigoRole = ur.codigoRole AND ISNULL(r.estadoRole, 1) = 1
    INNER JOIN dbo.PTL_ActividadesRoles ar ON ar.codigoRole = r.codigoRole AND ar.permiso = 1
    INNER JOIN dbo.PTL_Actividades a ON a.codigoActividad = ar.codigoActividad AND a.estadoActividad = 1
    WHERE ISNULL(u.estadoUsuarioSC, 1) = 1 AND a.llavePermiso = :llavePermiso`, { replacements: { llavePermiso }, type: QueryTypes.SELECT });
  return filas.map((f) => String(f.codigoUsuario));
}

module.exports = { tienePermiso, rolesDelUsuario, usuariosConPermiso, CONSULTA_PERMISO, CONSULTA_ROLES };
