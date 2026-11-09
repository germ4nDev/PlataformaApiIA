/*
    Author: German Valencia
    Pattern: PORTTOS Repository - Datos del maestro de widgets para la app móvil (solo lectura)
    Description: Desde OT-008 (2026-10-29) el layout del usuario y la plantilla los lee el servicio móvil con
      services/layout.service.js (los mismos de /api/layout). Aquí queda solo lo que esa plantilla no trae:
      - maestro(codigoPestana) → { nombres: { CODIGO: nombreWidget }, estados: { CODIGO: estadoWidget } }
      Las consultas anteriores (deUsuario, porDefecto, zonaDinamica) están en _respaldos/2026-10-29_layout-unico/.
      No escribe nada: /api/layout y /api/widgets siguen siendo los únicos que modifican estas tablas.
*/
const { QueryTypes } = require('sequelize');
const { db } = require('../../database/connection');

const consultar = (texto, replacements) => db.sequelize.query(texto, { replacements, type: QueryTypes.SELECT });

async function maestro(codigoPestana) {
  const filas = await consultar(`
    SELECT UPPER(LTRIM(RTRIM(codigoWidget))) AS codigoWidget, nombreWidget, estadoWidget
    FROM dbo.PTLWidgetsMaestro WHERE codigoPestana = :codigoPestana;`, { codigoPestana });
  return {
    nombres: Object.fromEntries(filas.map((f) => [f.codigoWidget, f.nombreWidget])),
    // estadoWidget NULL cuenta como activo (igual que antes en la app)
    estados: Object.fromEntries(filas.map((f) => [f.codigoWidget, f.estadoWidget === null ? true : f.estadoWidget])),
  };
}

/**
 * Widgets de la pestaña que permiten los roles del usuario (regla 18, fase 2): relaciones activas de PTLWidgetsRoles de sus
 * roles activos (PTLUsuariosSC → PTLUsuariosRole → PTLRolesAP), con el canal del maestro (canal, migración 030; movil, 028).
 * Lo mismo que arma la web al entrar (rolesYWidgetsDeAplicacion). Solo lectura.
 * @returns {Promise<Array<{ codigoWidget: string, movil: boolean, canal: string }>>}
 */
async function permitidosDeUsuario(codigoUsuario, codigoPestana) {
  return consultar(`
    SELECT DISTINCT UPPER(LTRIM(RTRIM(w.codigoWidget))) AS codigoWidget, CAST(ISNULL(w.movil, 0) AS BIT) AS movil,
           w.canal
    FROM dbo.PTLUsuariosSC u
    JOIN dbo.PTLUsuariosRole ur ON ur.codigoUsuarioSC = u.codigoUsuarioSC AND ISNULL(ur.estadoUsuarioRole, 1) = 1
    JOIN dbo.PTLRolesAP r ON r.codigoRole = ur.codigoRole AND ISNULL(r.estadoRole, 1) = 1
    JOIN dbo.PTLWidgetsRoles wr ON wr.codigoRole = r.codigoRole AND wr.estadoRelacion = 1
    JOIN dbo.PTLWidgetsMaestro w ON w.codigoWidget = wr.codigoWidget
    WHERE u.codigoUsuario = :codigoUsuario AND w.codigoPestana = :codigoPestana;`, { codigoUsuario, codigoPestana });
}

module.exports = { maestro, permitidosDeUsuario };
