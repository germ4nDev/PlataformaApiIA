/*
    Author: German Valencia
    Pattern: PORTTOS Repository - Layout del teléfono (OT-017 fase 2, migración 031)
    Description:
      widgetsPermitidos(codigoUsuario, codigoPestana?)  filas del maestro (activas) que permiten los roles activos del usuario
                                                         (PTL_UsuariosSC → PTL_UsuariosRole → PTL_RolesAP → PTL_WidgetsRoles), con canal
                                                         (030) y tamaño por defecto. Solo lectura.
      guardado(codigoUsuario, codigoPestana)            { items, version, fechaModificacion } o null
      guardar(codigoUsuario, codigoPestana, items)      crea o actualiza la fila (version + 1); devuelve la versión
      borrar(codigoUsuario, codigoPestana)              vuelve al por defecto (borra la fila del usuario en esa pestaña)
    Solo escribe en TCL_LayoutTelefono. /api/layout y /api/widgets no se tocan (regla 7).
*/
const { QueryTypes } = require('sequelize');
const { db } = require('../../database/connection');

const consultar = (texto, replacements) => db.sequelize.query(texto, { replacements, type: QueryTypes.SELECT });

async function widgetsPermitidos(codigoUsuario, codigoPestana = null) {
  return consultar(`
    SELECT DISTINCT UPPER(LTRIM(RTRIM(w.codigoWidget))) AS codigoWidget, UPPER(LTRIM(RTRIM(w.codigoPestana))) AS codigoPestana,
           w.nombreWidget, w.defaultCols, w.defaultRows, w.pos_x, w.pos_y, w.canal, CAST(ISNULL(w.movil, 0) AS BIT) AS movil
    FROM dbo.PTL_UsuariosSC u
    JOIN dbo.PTL_UsuariosRole ur ON ur.codigoUsuarioSC = u.codigoUsuarioSC AND ISNULL(ur.estadoUsuarioRole, 1) = 1
    JOIN dbo.PTL_RolesAP r ON r.codigoRole = ur.codigoRole AND ISNULL(r.estadoRole, 1) = 1
    JOIN dbo.PTL_WidgetsRoles wr ON wr.codigoRole = r.codigoRole AND wr.estadoRelacion = 1
    JOIN dbo.PTL_WidgetsMaestro w ON w.codigoWidget = wr.codigoWidget AND ISNULL(w.estadoWidget, 1) = 1
    WHERE u.codigoUsuario = :codigoUsuario
      AND (:codigoPestana IS NULL OR UPPER(LTRIM(RTRIM(w.codigoPestana))) = :codigoPestana);`,
  { codigoUsuario, codigoPestana });
}

async function guardado(codigoUsuario, codigoPestana) {
  const filas = await consultar(`
    SELECT TOP 1 layout, version, fechaModificacion FROM dbo.TCL_LayoutTelefono
    WHERE codigoUsuario = :codigoUsuario AND codigoPestana = :codigoPestana;`, { codigoUsuario, codigoPestana });
  if (!filas.length) return null;
  let items = [];
  try { items = JSON.parse(filas[0].layout); } catch { items = []; }
  return { items: Array.isArray(items) ? items : [], version: filas[0].version, fechaModificacion: filas[0].fechaModificacion };
}

async function guardar(codigoUsuario, codigoPestana, items) {
  const layout = JSON.stringify(items);
  const filas = await consultar(`
    SET NOCOUNT ON;
    UPDATE dbo.TCL_LayoutTelefono SET layout = :layout, version = version + 1, fechaModificacion = SYSUTCDATETIME()
    WHERE codigoUsuario = :codigoUsuario AND codigoPestana = :codigoPestana;
    IF @@ROWCOUNT = 0
      INSERT INTO dbo.TCL_LayoutTelefono (codigoUsuario, codigoPestana, layout) VALUES (:codigoUsuario, :codigoPestana, :layout);
    SELECT version FROM dbo.TCL_LayoutTelefono WHERE codigoUsuario = :codigoUsuario AND codigoPestana = :codigoPestana;`,
  { codigoUsuario, codigoPestana, layout });
  return filas[0]?.version ?? 1;
}

async function borrar(codigoUsuario, codigoPestana) {
  await db.sequelize.query(
    'DELETE FROM dbo.TCL_LayoutTelefono WHERE codigoUsuario = :codigoUsuario AND codigoPestana = :codigoPestana;',
    { replacements: { codigoUsuario, codigoPestana } });
}

module.exports = { widgetsPermitidos, guardado, guardar, borrar };
