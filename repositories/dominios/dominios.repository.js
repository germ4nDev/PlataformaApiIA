/*
    Author: German Valencia
    Pattern: PLATAFORMA Repository - Dominios de la plataforma (OT-012, migración 026)
      dominios()                  filas de PTLDominiosAP (todas: el núcleo descarta las inactivas). Sin la 026 → [] (todo neutro, como hoy)
      aplicacionesDeUsuario(cod)  códigos de aplicación en los que el usuario tiene un rol activo
                                  (PTLUsuariosSC → PTLUsuariosRole → PTLRolesAP, los mismos modelos de la plataforma)
*/
const { QueryTypes } = require('sequelize');
const { db } = require('../../database/connection');
const { esTablaInexistente, esColumnaInexistente } = require('../../helpers/errores.helper');

async function dominios() {
  try {
    return await db.sequelize.query(`
      SELECT dominio, tipo, codigoAplicacion, codigoSuite, rutaPortal, rutaInicio, nombreMarca, logoMarca, estado
      FROM dbo.PTLDominiosAP`, { type: QueryTypes.SELECT });
  } catch (error) {
    if (esTablaInexistente(error) || esColumnaInexistente(error) || /Invalid object name/i.test(error?.message || '')) return [];
    throw error;
  }
}

async function aplicacionesDeUsuario(codigoUsuario) {
  const filas = await db.sequelize.query(`
    SELECT DISTINCT r.codigoAplicacion
    FROM dbo.PTLUsuariosSC u
    INNER JOIN dbo.PTLUsuariosRole ur ON ur.codigoUsuarioSC = u.codigoUsuarioSC
    INNER JOIN dbo.PTLRolesAP r ON r.codigoRole = ur.codigoRole
    WHERE u.codigoUsuario = :codigoUsuario
      AND COALESCE(ur.estadoUsuarioRole, 1) = 1
      AND COALESCE(r.estadoRole, 1) = 1`, { replacements: { codigoUsuario }, type: QueryTypes.SELECT });
  return filas.map((f) => f.codigoAplicacion).filter(Boolean);
}

module.exports = { dominios, aplicacionesDeUsuario };
