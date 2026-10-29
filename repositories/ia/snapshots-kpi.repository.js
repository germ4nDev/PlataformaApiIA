/*
    Author: German Valencia
    Pattern: PORTTOS Repository - Fotos de KPI de la capa de IA (TCL_SnapshotsKpi · migración 015)
    Description:
      - guardar(filas): inserta las fotos de un ciclo; si ya existe la de ese puerto, KPI y cuarto de hora, no la repite.
      - serie(puerto, desde): fotos desde una fecha, ordenadas por KPI y fecha (las series de las señales).
      - estado(puerto): cuántas fotos hay y de cuándo es la última.
      - purgar(antes): retención (IA_RETENCION_DIAS).
    Sin la migración 015 lanza migracionPendiente (503); el servicio apaga las fotos hasta el próximo reinicio.
    Fechas: DATETIME2(0) en UTC; se devuelven como ISO con Z.
*/
const { QueryTypes } = require('sequelize');
const { db } = require('../../database/connection');
const { esColumnaInexistente, esTablaInexistente, migracionPendiente } = require('../../helpers/errores.helper');

const MIGRACION_015 = '015_analisis_ia.sql';
const LOTE = 200;   // 8 parámetros por fila, bajo el tope de 2100 de SQL Server

async function ejecutar(sql, replacements = {}, type = QueryTypes.SELECT) {
  try {
    return await db.sequelize.query(sql, { replacements, type });
  } catch (error) {
    if (esTablaInexistente(error) || esColumnaInexistente(error) || /Invalid object name/i.test(error?.message || '')) {
      throw migracionPendiente(MIGRACION_015);
    }
    throw error;
  }
}

/** @param {Array<{puerto, modulo, codigoKpi, valor, unidad, simulado, esRespaldo, fecha}>} filas */
async function guardar(filas) {
  let total = 0;
  for (let i = 0; i < filas.length; i += LOTE) {
    const lote = filas.slice(i, i + LOTE);
    const valores = [];
    const r = {};
    lote.forEach((f, j) => {
      valores.push(`(:pu${j}, :mo${j}, :co${j}, CAST(:va${j} AS FLOAT), :un${j}, :si${j}, :re${j}, CAST(:fe${j} AS DATETIME2(0)))`);
      Object.assign(r, {
        [`pu${j}`]: f.puerto, [`mo${j}`]: f.modulo, [`co${j}`]: f.codigoKpi,
        [`va${j}`]: f.valor === null || f.valor === undefined ? null : Number(f.valor), [`un${j}`]: f.unidad || null,
        [`si${j}`]: f.simulado ? 1 : 0, [`re${j}`]: f.esRespaldo ? 1 : 0, [`fe${j}`]: String(f.fecha).replace('Z', '').replace('T', ' ').slice(0, 19),
      });
    });
    await ejecutar(`
      INSERT INTO dbo.TCL_SnapshotsKpi (puerto, modulo, codigoKpi, valor, unidad, simulado, esRespaldo, fecha)
      SELECT v.puerto, v.modulo, v.codigoKpi, v.valor, v.unidad, v.simulado, v.esRespaldo, v.fecha
      FROM (VALUES ${valores.join(', ')}) AS v (puerto, modulo, codigoKpi, valor, unidad, simulado, esRespaldo, fecha)
      WHERE NOT EXISTS (SELECT 1 FROM dbo.TCL_SnapshotsKpi s
                        WHERE s.puerto = v.puerto AND s.codigoKpi = v.codigoKpi AND s.fecha = v.fecha)`, r, QueryTypes.INSERT);
    total += lote.length;
  }
  return total;
}

/** Fotos del puerto desde una fecha (ISO), por KPI y fecha ascendente. */
async function serie(puerto, desdeIso) {
  return ejecutar(`
    SELECT codigoKpi, modulo, valor, unidad, CAST(simulado AS BIT) AS simulado, CAST(esRespaldo AS BIT) AS esRespaldo,
           CONVERT(VARCHAR(19), fecha, 126) + 'Z' AS fecha
    FROM dbo.TCL_SnapshotsKpi WITH (NOLOCK)
    WHERE puerto = :puerto AND fecha >= CAST(:desde AS DATETIME2(0))
    ORDER BY codigoKpi, fecha`,
  { puerto, desde: String(desdeIso).replace('Z', '').replace('T', ' ').slice(0, 19) });
}

/**
 * Promedios por hora o por día (UTC) de cada KPI desde una fecha, para las tendencias de 24 h, 7 y 30 días.
 * Sin las fotos de respaldo (esRespaldo = 1): repiten el último valor bueno y aplanarían la tendencia.
 * @param {'hora'|'dia'} grano
 */
async function agregados(puerto, desdeIso, grano = 'hora') {
  const corte = grano === 'dia' ? 'DATEADD(DAY, DATEDIFF(DAY, 0, fecha), 0)' : 'DATEADD(HOUR, DATEDIFF(HOUR, 0, fecha), 0)';
  return ejecutar(`
    SELECT codigoKpi, CONVERT(VARCHAR(19), ${corte}, 126) + 'Z' AS periodo,
           CAST(AVG(CAST(valor AS FLOAT)) AS FLOAT) AS prom, CAST(MIN(valor) AS FLOAT) AS minimo, CAST(MAX(valor) AS FLOAT) AS maximo,
           COUNT(*) AS n, CAST(MAX(CAST(simulado AS INT)) AS BIT) AS simulado
    FROM dbo.TCL_SnapshotsKpi WITH (NOLOCK)
    WHERE puerto = :puerto AND fecha >= CAST(:desde AS DATETIME2(0)) AND valor IS NOT NULL AND esRespaldo = 0
    GROUP BY codigoKpi, ${corte}
    ORDER BY codigoKpi, periodo`,
  { puerto, desde: String(desdeIso).replace('Z', '').replace('T', ' ').slice(0, 19) });
}

/** Cuántas fotos hay del puerto y la fecha de la primera y la última. */
async function estado(puerto) {
  const [fila] = await ejecutar(`
    SELECT COUNT(*) AS fotos, COUNT(DISTINCT codigoKpi) AS kpis,
           CONVERT(VARCHAR(19), MIN(fecha), 126) + 'Z' AS primera, CONVERT(VARCHAR(19), MAX(fecha), 126) + 'Z' AS ultima
    FROM dbo.TCL_SnapshotsKpi WITH (NOLOCK) WHERE puerto = :puerto`, { puerto });
  return fila || { fotos: 0, kpis: 0, primera: null, ultima: null };
}

/** Borra las fotos anteriores a la fecha (retención). Devuelve cuántas borró. */
async function purgar(antesIso) {
  const res = await ejecutar(
    'DELETE FROM dbo.TCL_SnapshotsKpi WHERE fecha < CAST(:antes AS DATETIME2(0))',
    { antes: String(antesIso).replace('Z', '').replace('T', ' ').slice(0, 19) }, QueryTypes.DELETE);
  return Array.isArray(res) && typeof res[1] === 'number' ? res[1] : 0;
}

module.exports = { guardar, serie, agregados, estado, purgar, MIGRACION_015 };
