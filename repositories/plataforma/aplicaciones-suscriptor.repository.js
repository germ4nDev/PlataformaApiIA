/*
    Author: German Valencia
    Pattern: PLATAFORMA Repository - Aplicaciones que un suscriptor tiene con licencia (OT-026; regla común del CC-145)
    Description:
      Una aplicación está asignada a un suscriptor si viene en un módulo de un paquete con licencia activa:
      PTL_PaquetesSC (estadoLicencia = 1) → PTL_ModulosPQ (activo) → codigoAplicacion. Es la misma regla del acceso por dominio.
      aplicacionesDeSuscriptor(cod)  [{ codigoAplicacion, nombreAplicacion }] del suscriptor (para asignar roles, OT-026)
      aplicacionesDeUsuario(cod)     códigos de aplicación de todos los suscriptores a los que está vinculado el usuario (CC-145)
*/
const { QueryTypes } = require('sequelize');
const { db } = require('../../database/connection');

// La única definición de «aplicación asignada»: módulo activo de un paquete con licencia activa
const MODULOS_CON_LICENCIA = 'INNER JOIN dbo.PTL_ModulosPQ m ON m.codigoPaquete = p.codigoPaquete';
const LICENCIA_ACTIVA = 'p.estadoLicencia = 1 AND COALESCE(m.estadoModuloPQ, 1) = 1';

async function aplicacionesDeSuscriptor(codigoSuscriptor) {
  return db.sequelize.query(`
    SELECT DISTINCT m.codigoAplicacion, a.nombreAplicacion
    FROM dbo.PTL_PaquetesSC p
    ${MODULOS_CON_LICENCIA}
    LEFT JOIN dbo.PTL_Aplicaciones a ON a.codigoAplicacion = m.codigoAplicacion
    WHERE ${LICENCIA_ACTIVA}
      AND p.codigoSuscriptor = :codigoSuscriptor`, { replacements: { codigoSuscriptor }, type: QueryTypes.SELECT });
}

async function aplicacionesDeUsuario(codigoUsuario) {
  const filas = await db.sequelize.query(`
    SELECT DISTINCT m.codigoAplicacion
    FROM dbo.PTL_UsuariosSC u
    INNER JOIN dbo.PTL_PaquetesSC p ON p.codigoSuscriptor = u.codigoSuscriptor
    ${MODULOS_CON_LICENCIA}
    WHERE ${LICENCIA_ACTIVA}
      AND u.codigoUsuario = :codigoUsuario
      AND COALESCE(u.estadoUsuarioSC, 1) = 1`, { replacements: { codigoUsuario }, type: QueryTypes.SELECT });
  return filas.map((f) => f.codigoAplicacion).filter(Boolean);
}

module.exports = { aplicacionesDeSuscriptor, aplicacionesDeUsuario };
