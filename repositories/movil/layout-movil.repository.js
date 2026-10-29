/*
    Author: German Valencia
    Pattern: PORTTOS Repository - Layout de la Torre de Control para la app móvil (solo lectura)
    Description: Lee el mismo layout que arma la web (layout-metadata-engine): el del usuario en dbo.PTLLayouts o, si
      no tiene, la plantilla por defecto de dbo.PTLWidgetsMaestro (inicial = 1). No escribe nada: /api/layout y
      /api/widgets siguen siendo los únicos que modifican estas tablas.
      - deUsuario(codigoUsuario, codigoPestana)  → [{ codigoWidget, x, y, cols, rows }]   (el último registro por widget)
      - porDefecto(codigoPestana)                → [{ codigoWidget, x, y, cols, rows }]   (inicial = 1 y widget activo)
      - nombres(codigoPestana)                   → { CODIGO: nombreWidget }
      - zonaDinamica(codigoPestana)              → { inicioX, inicioY, colsPorItem, rowsPorItem, maxItemsPorFila } | null
*/
const { QueryTypes } = require('sequelize');
const { db } = require('../../database/connection');

const consultar = (texto, replacements) => db.sequelize.query(texto, { replacements, type: QueryTypes.SELECT });

async function deUsuario(codigoUsuario, codigoPestana) {
  return consultar(`
    SELECT codigoWidget, x, y, cols, rows FROM (
      SELECT UPPER(LTRIM(RTRIM(codigoWidget))) AS codigoWidget, posicion_x AS x, posicion_y AS y, cols, rows,
             ROW_NUMBER() OVER (PARTITION BY UPPER(LTRIM(RTRIM(codigoWidget))) ORDER BY layoutId DESC) AS n
      FROM dbo.PTLLayouts
      WHERE codigoUsuario = :codigoUsuario AND codigoPestana = :codigoPestana
    ) t WHERE n = 1;`, { codigoUsuario, codigoPestana });
}

async function porDefecto(codigoPestana) {
  return consultar(`
    SELECT UPPER(LTRIM(RTRIM(codigoWidget))) AS codigoWidget, pos_x AS x, pos_y AS y, defaultCols AS cols, defaultRows AS rows
    FROM dbo.PTLWidgetsMaestro
    WHERE codigoPestana = :codigoPestana AND inicial = 1 AND ISNULL(estadoWidget, 1) = 1;`, { codigoPestana });
}

async function nombres(codigoPestana) {
  const filas = await consultar(`
    SELECT UPPER(LTRIM(RTRIM(codigoWidget))) AS codigoWidget, nombreWidget
    FROM dbo.PTLWidgetsMaestro WHERE codigoPestana = :codigoPestana;`, { codigoPestana });
  return Object.fromEntries(filas.map((f) => [f.codigoWidget, f.nombreWidget]));
}

async function zonaDinamica(codigoPestana) {
  try {
    const [fila] = await consultar(`SELECT TOP 1 inicioX, inicioY, colsPorItem, rowsPorItem, maxItemsPorFila
      FROM dbo.PTLCfgZonasDinamicas WHERE codigoPestana = :codigoPestana;`, { codigoPestana });
    return fila ? {
      inicioX: Number(fila.inicioX) || 0, inicioY: Number(fila.inicioY), colsPorItem: Number(fila.colsPorItem) || 4,
      rowsPorItem: Number(fila.rowsPorItem) || 3, maxItemsPorFila: Number(fila.maxItemsPorFila) || 3,
    } : null;
  } catch {
    return null;   // sin la tabla de zonas: las terminales van donde estén sus tarjetas (o no van)
  }
}

module.exports = { deUsuario, porDefecto, nombres, zonaDinamica };
