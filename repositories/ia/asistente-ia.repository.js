/*
    Author: German Valencia
    Pattern: PORTTOS Repository - Asistente de la capa de IA (migración 018)
    Description:
      - registrarPregunta(p) → id              una fila por pregunta en TCL_IAPreguntas
      - preguntasDelDia(usuario, desdeIso)      cuántas lleva el usuario hoy (tope por usuario)
      - obtenerPregunta(id) / votarPregunta(id, util, comentario)
      - preguntas({ desdeIso, decision, limite }) / resumenPreguntas(desdeIso)   panel de administración
      - temasAlcance() / guardarTema(t, usuario)  ajustes al marco de alcance (TCL_IAAlcance); no borra: activo = 0
    Sin la 018 lanza migracionPendiente('018_ia_asistente.sql').
*/
const { QueryTypes } = require('sequelize');
const { db } = require('../../database/connection');
const { esColumnaInexistente, esTablaInexistente, migracionPendiente } = require('../../helpers/errores.helper');

const MIGRACION_018 = '018_ia_asistente.sql';
const sql = (iso) => (iso ? String(iso).replace('Z', '').replace('T', ' ').slice(0, 19) : null);
const json = (v) => (v === null || v === undefined ? null : JSON.stringify(v));

async function ejecutar(texto, replacements = {}, type = QueryTypes.SELECT) {
  try {
    return await db.sequelize.query(texto, { replacements, type });
  } catch (error) {
    if (esTablaInexistente(error) || esColumnaInexistente(error) || /Invalid object name/i.test(error?.message || '')) throw migracionPendiente(MIGRACION_018);
    throw error;
  }
}

async function registrarPregunta(p) {
  const [fila] = await ejecutar(`
    INSERT INTO dbo.TCL_IAPreguntas (usuario, puerto, pestana, pregunta, decision, origenDecision, tema, motivo, estado, respuesta,
                                     fuentes, herramientas, verificacion, idEjecucion, idEjecucionFiltro, latenciaMs)
    OUTPUT INSERTED.id AS id
    VALUES (:usuario, :puerto, :pestana, :pregunta, :decision, :origenDecision, :tema, :motivo, :estado, :respuesta,
            :fuentes, :herramientas, :verificacion, :idEjecucion, :idEjecucionFiltro, :latenciaMs)`, {
    usuario: String(p.usuario || 'desconocido').slice(0, 200), puerto: p.puerto || null, pestana: p.pestana ? String(p.pestana).slice(0, 60) : null,
    pregunta: String(p.pregunta).slice(0, 1000), decision: p.decision, origenDecision: p.origenDecision, tema: p.tema || null,
    motivo: p.motivo ? String(p.motivo).slice(0, 200) : null, estado: p.estado, respuesta: p.respuesta || null,
    fuentes: json(p.fuentes), herramientas: json(p.herramientas), verificacion: p.verificacion ? String(p.verificacion).slice(0, 400) : null,
    idEjecucion: p.idEjecucion ?? null, idEjecucionFiltro: p.idEjecucionFiltro ?? null, latenciaMs: p.latenciaMs ?? null,
  });
  return fila?.id ?? null;
}

async function preguntasDelDia(usuario, desdeIso) {
  const [fila] = await ejecutar(`SELECT COUNT(*) AS n FROM dbo.TCL_IAPreguntas WITH (NOLOCK)
    WHERE usuario = :usuario AND fecha >= CAST(:desde AS DATETIME2(0))`, { usuario: String(usuario).slice(0, 200), desde: sql(desdeIso) });
  return Number(fila?.n) || 0;
}

const COLUMNAS = `id, usuario, puerto, pestana, pregunta, decision, origenDecision, tema, motivo, estado, respuesta, fuentes, herramientas,
  verificacion, idEjecucion, idEjecucionFiltro, CAST(util AS BIT) AS util, comentario, latenciaMs, CONVERT(VARCHAR(19), fecha, 126) + 'Z' AS fecha`;

async function obtenerPregunta(id) {
  const [fila] = await ejecutar(`SELECT ${COLUMNAS} FROM dbo.TCL_IAPreguntas WITH (NOLOCK) WHERE id = :id`, { id });
  return fila || null;
}

async function votarPregunta(id, util, comentario) {
  await ejecutar('UPDATE dbo.TCL_IAPreguntas SET util = :util, comentario = :comentario WHERE id = :id',
    { id, util: util ? 1 : 0, comentario: comentario ? String(comentario).slice(0, 500) : null }, QueryTypes.UPDATE);
}

async function preguntas({ desdeIso, decision = null, limite = 100 }) {
  return ejecutar(`SELECT TOP (:limite) ${COLUMNAS} FROM dbo.TCL_IAPreguntas WITH (NOLOCK)
    WHERE fecha >= CAST(:desde AS DATETIME2(0)) AND (:decision IS NULL OR decision = :decision)
    ORDER BY fecha DESC`, { desde: sql(desdeIso), decision, limite });
}

async function resumenPreguntas(desdeIso) {
  return ejecutar(`
    SELECT decision, ISNULL(tema, N'—') AS tema, estado, COUNT(*) AS cantidad,
           SUM(CASE WHEN util = 1 THEN 1 ELSE 0 END) AS utiles, SUM(CASE WHEN util = 0 THEN 1 ELSE 0 END) AS noUtiles,
           AVG(latenciaMs) AS latenciaMediaMs
    FROM dbo.TCL_IAPreguntas WITH (NOLOCK) WHERE fecha >= CAST(:desde AS DATETIME2(0))
    GROUP BY decision, ISNULL(tema, N'—'), estado ORDER BY decision, tema, estado`, { desde: sql(desdeIso) });
}

async function temasAlcance() {
  return ejecutar(`SELECT codigo, nombre, ambito, descripcion, palabrasClave, ejemplos, CAST(activo AS BIT) AS activo, orden, modificadoPor,
    CONVERT(VARCHAR(19), fechaModificacion, 126) + 'Z' AS fechaModificacion FROM dbo.TCL_IAAlcance WITH (NOLOCK) ORDER BY ISNULL(orden, 99), codigo`);
}

async function guardarTema(t, usuario) {
  await ejecutar(`
    MERGE dbo.TCL_IAAlcance AS d
    USING (SELECT :codigo AS codigo) AS s ON d.codigo = s.codigo
    WHEN MATCHED THEN UPDATE SET nombre = :nombre, ambito = :ambito, descripcion = :descripcion, palabrasClave = :palabrasClave,
      ejemplos = :ejemplos, activo = :activo, orden = :orden, modificadoPor = :usuario, fechaModificacion = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN INSERT (codigo, nombre, ambito, descripcion, palabrasClave, ejemplos, activo, orden, modificadoPor)
      VALUES (:codigo, :nombre, :ambito, :descripcion, :palabrasClave, :ejemplos, :activo, :orden, :usuario);`, {
    codigo: t.codigo, nombre: t.nombre, ambito: t.ambito, descripcion: t.descripcion, palabrasClave: json(t.palabrasClave || []),
    ejemplos: json(t.ejemplos || []), activo: t.activo === false ? 0 : 1, orden: t.orden ?? null, usuario: String(usuario || 'desconocido').slice(0, 200),
  }, QueryTypes.UPSERT);
}

module.exports = {
  MIGRACION_018, registrarPregunta, preguntasDelDia, obtenerPregunta, votarPregunta, preguntas, resumenPreguntas, temasAlcance, guardarTema,
};
