/*
    Author: German Valencia
    Repositorio de permisos (CC-128): ¿el vínculo del usuario con el suscriptor (PTLUsuariosSC.codigoUsuarioSC) tiene, por alguno de sus
    roles activos en la empresa de la sesión (PTLUsuariosRole.codigoEmpresaSC), la actividad con esa llavePermiso y permiso = 1? Solo lectura.
*/
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../../database/connection');

const CONSULTA_PERMISO = `
  SELECT TOP (1) 1 AS ok
  FROM dbo.PTLUsuariosSC u
  INNER JOIN dbo.PTLUsuariosRole ur ON ur.codigoUsuarioSC = u.codigoUsuarioSC AND ISNULL(ur.estadoUsuarioRole, 1) = 1
                                 AND ur.codigoEmpresaSC = :codigoEmpresaSC
  INNER JOIN dbo.PTLRolesAP r ON r.codigoRole = ur.codigoRole AND ISNULL(r.estadoRole, 1) = 1
  INNER JOIN dbo.PTLActividadesRoles ar ON ar.codigoRole = r.codigoRole AND ar.permiso = 1
  INNER JOIN dbo.PTLActividades a ON a.codigoActividad = ar.codigoActividad AND a.estadoActividad = 1
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

module.exports = { tienePermiso, CONSULTA_PERMISO };
