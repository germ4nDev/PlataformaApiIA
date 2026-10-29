/*
    Author: German Valencia
    Pattern: PORTTOS Repository - Resúmenes de turno y diarios de la capa de IA (migraciones 015 y 017)
    Description: Los resúmenes son filas de TCL_IAHallazgos con clase RESUMEN y tipo cierre_turno | resumen_diario;
      'entidad' guarda la clave del periodo (T2026-10-24T14, D2026-10-23) y 'contenido' el JSON del resumen.
      - existeResumen(puerto, tipo, clave)  para no repetir un periodo
      - guardarResumen(h) → id
      - resumenes(puerto, { tipos, desdeIso, limite })
      - alertasDelPeriodo(puerto, desdeIso, hastaIso)   alertas creadas en el periodo, con su estado y verificación
    Sin la 017 (columna contenido) lanza migracionPendiente('017_ia_resumenes_admin.sql').
*/
const { QueryTypes } = require('sequelize');
const { db } = require('../../database/connection');
const { esColumnaInexistente, esTablaInexistente, migracionPendiente } = require('../../helpers/errores.helper');

const MIGRACION_017 = '017_ia_resumenes_admin.sql';
const TIPOS_RESUMEN = Object.freeze(['cierre_turno', 'resumen_diario']);
const sql = (iso) => (iso ? String(iso).replace('Z', '').replace('T', ' ').slice(0, 19) : null);

async function ejecutar(texto, replacements = {}, type = QueryTypes.SELECT) {
  try {
    return await db.sequelize.query(texto, { replacements, type });
  } catch (error) {
    if (esTablaInexistente(error) || /Invalid object name/i.test(error?.message || '')) throw migracionPendiente('015_analisis_ia.sql');
    if (esColumnaInexistente(error)) throw migracionPendiente(MIGRACION_017);
    throw error;
  }
}

async function existeResumen(puerto, tipo, clave) {
  const [fila] = await ejecutar(`SELECT TOP 1 id FROM dbo.TCL_IAHallazgos WITH (NOLOCK)
    WHERE puerto = :puerto AND clase = N'RESUMEN' AND tipo = :tipo AND entidad = :clave`, { puerto, tipo, clave });
  return !!fila;
}

async function guardarResumen(h) {
  const [fila] = await ejecutar(`
    INSERT INTO dbo.TCL_IAHallazgos (idEjecucion, puerto, clase, tipo, entidad, titulo, explicacion, evidencia, estado, vigenteHasta, resultado, contenido)
    OUTPUT INSERTED.id AS id
    VALUES (:idEjecucion, :puerto, N'RESUMEN', :tipo, :entidad, :titulo, :explicacion, :evidencia, :estado,
            CAST(:vigenteHasta AS DATETIME2(0)), :resultado, :contenido)`, {
    idEjecucion: h.idEjecucion ?? null, puerto: h.puerto, tipo: h.tipo, entidad: String(h.entidad).slice(0, 120),
    titulo: String(h.titulo).slice(0, 200), explicacion: h.explicacion ? String(h.explicacion).slice(0, 1000) : null,
    evidencia: JSON.stringify(h.evidencia || []), estado: h.estado, vigenteHasta: sql(h.vigenteHasta),
    resultado: h.resultado ? String(h.resultado).slice(0, 400) : null, contenido: JSON.stringify(h.contenido || {}),
  });
  return fila?.id ?? null;
}

async function resumenes(puerto, { tipos = TIPOS_RESUMEN, desdeIso, limite = 20 }) {
  return ejecutar(`
    SELECT TOP (:limite) id, idEjecucion, puerto, tipo, entidad AS clave, titulo, explicacion, evidencia, estado, resultado, contenido,
           CONVERT(VARCHAR(19), fecha, 126) + 'Z' AS fecha
    FROM dbo.TCL_IAHallazgos WITH (NOLOCK)
    WHERE puerto = :puerto AND clase = N'RESUMEN' AND tipo IN (:tipos) AND fecha >= CAST(:desde AS DATETIME2(0))
    ORDER BY fecha DESC`, { puerto, tipos, desde: sql(desdeIso), limite });
}

async function alertasDelPeriodo(puerto, desdeIso, hastaIso) {
  return ejecutar(`
    SELECT TOP 100 id, puerto, clase, tipo, entidad, severidad, CAST(confianza AS FLOAT) AS confianza, titulo, estado, resultado,
           CONVERT(VARCHAR(19), vigenteHasta, 126) + 'Z' AS vigenteHasta, CONVERT(VARCHAR(19), fecha, 126) + 'Z' AS fecha
    FROM dbo.TCL_IAHallazgos WITH (NOLOCK)
    WHERE puerto = :puerto AND clase = N'ALERTA' AND estado <> N'DESCARTADO'
      AND fecha >= CAST(:desde AS DATETIME2(0)) AND fecha < CAST(:hasta AS DATETIME2(0))
    ORDER BY CASE severidad WHEN N'critica' THEN 0 WHEN N'atencion' THEN 1 ELSE 2 END, fecha DESC`,
  { puerto, desde: sql(desdeIso), hasta: sql(hastaIso) });
}

module.exports = { MIGRACION_017, TIPOS_RESUMEN, existeResumen, guardarResumen, resumenes, alertasDelPeriodo };
