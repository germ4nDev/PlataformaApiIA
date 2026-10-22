/*
    Author: German Valencia
    Pattern: PORTTOS Repository - Noticias, indicadores de mercado y fuentes de información (migración 013)
    Description: TCL_Noticias (sin repetidos por id_hash), TCL_IndicadoresMercado (TRM) y TCL_FuentesInformacion.
      Sin la migración 013 lanza migracionPendiente (503).
*/
const { QueryTypes } = require('sequelize');
const { db } = require('../../database/connection');
const { esColumnaInexistente, esTablaInexistente, migracionPendiente } = require('../../helpers/errores.helper');

const MIGRACION_013 = '013_granel_suelta_capacidad_noticias.sql';

async function q(sql, replacements = {}, type = QueryTypes.SELECT) {
  try {
    return await db.sequelize.query(sql, { replacements, type });
  } catch (error) {
    if (esTablaInexistente(error) || esColumnaInexistente(error) || /Invalid object name/i.test(error?.message || '')) {
      throw migracionPendiente(MIGRACION_013);
    }
    throw error;
  }
}

/** Noticias publicadas desde la fecha dada; primero las del puerto y las más relevantes. */
const recientes = (desde, limite = 120) => q(`
  SELECT TOP (:limite) id_hash, titulo, resumen, url, medio, proveedor, categoria, id_puerto, relevancia, fecha_publicacion
  FROM dbo.TCL_Noticias WITH (NOLOCK)
  WHERE fecha_publicacion >= :desde
  ORDER BY fecha_publicacion DESC`, { desde, limite });

/** Inserta las que no existan (por id_hash). Devuelve cuántas eran nuevas. */
async function guardar(noticias) {
  let nuevas = 0;
  for (const n of noticias) {
    const [r] = await q(`
      IF NOT EXISTS (SELECT 1 FROM dbo.TCL_Noticias WHERE id_hash = :id_hash)
      BEGIN
        INSERT INTO dbo.TCL_Noticias (id_hash, titulo, resumen, url, medio, proveedor, categoria, id_puerto, relevancia, fecha_publicacion, fecha_ingesta)
        VALUES (:id_hash, :titulo, :resumen, :url, :medio, :proveedor, :categoria, :id_puerto, :relevancia, :fecha_publicacion, :fecha_ingesta);
        SELECT 1 AS nueva;
      END
      ELSE SELECT 0 AS nueva;`, n);
    nuevas += Number(r?.nueva) || 0;
  }
  return nuevas;
}

const indicador = (codigo, limite = 2) => q(`
  SELECT TOP (:limite) codigo, fecha, CAST(valor AS FLOAT) AS valor, unidad, fuente
  FROM dbo.TCL_IndicadoresMercado WITH (NOLOCK) WHERE codigo = :codigo ORDER BY fecha DESC`, { codigo, limite });

async function guardarIndicador(i) {
  await q(`
    MERGE dbo.TCL_IndicadoresMercado AS d
    USING (SELECT :codigo AS codigo, :fecha AS fecha) AS s ON d.codigo = s.codigo AND d.fecha = s.fecha
    WHEN MATCHED THEN UPDATE SET valor = :valor, unidad = :unidad, fuente = :fuente, fecha_ingesta = :fecha_ingesta
    WHEN NOT MATCHED THEN INSERT (codigo, fecha, valor, unidad, fuente, fecha_ingesta)
      VALUES (:codigo, :fecha, :valor, :unidad, :fuente, :fecha_ingesta);`, i, QueryTypes.UPSERT);
}

const fuentes = () => q(`
  SELECT grupo, nombre, descripcion, url, orden FROM dbo.TCL_FuentesInformacion WITH (NOLOCK) WHERE activo = 1 ORDER BY grupo, orden`);

const purgar = (antes) => q('DELETE FROM dbo.TCL_Noticias WHERE fecha_publicacion < :antes', { antes }, QueryTypes.DELETE);

module.exports = { MIGRACION_013, recientes, guardar, indicador, guardarIndicador, fuentes, purgar };
