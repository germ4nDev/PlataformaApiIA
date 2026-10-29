/*
    Author: German Valencia
    Pattern: PORTTOS Repository - Capa de análisis con IA (migración 015): ejecuciones, hallazgos y prompts
    Description:
      - registrarEjecucion(e) → id           una fila por llamada (u omisión) al modelo en TCL_IAEjecuciones
      - usoDelDia(puerto, tarea, desde)      llamadas y tokens gastados hoy (presupuesto)
      - promptActivo(tarea)                  prompt ACTIVO de TCL_IAPrompts o null
      - hallazgosVigentes / crearHallazgo / actualizarHallazgo / hallazgos / resumenHallazgos / uso
    Sin la migración 015 lanza migracionPendiente (503).
*/
const { QueryTypes } = require('sequelize');
const { db } = require('../../database/connection');
const { esColumnaInexistente, esTablaInexistente, migracionPendiente } = require('../../helpers/errores.helper');

const MIGRACION_015 = '015_analisis_ia.sql';
const sql = (iso) => (iso ? String(iso).replace('Z', '').replace('T', ' ').slice(0, 19) : null);

async function ejecutar(texto, replacements = {}, type = QueryTypes.SELECT) {
  try {
    return await db.sequelize.query(texto, { replacements, type });
  } catch (error) {
    if (esTablaInexistente(error) || esColumnaInexistente(error) || /Invalid object name/i.test(error?.message || '')) {
      throw migracionPendiente(MIGRACION_015);
    }
    throw error;
  }
}

async function registrarEjecucion(e) {
  const [fila] = await ejecutar(`
    INSERT INTO dbo.TCL_IAEjecuciones (codigoTarea, puerto, idPrompt, proveedor, modelo, tokensEntrada, tokensSalida, tokensCache,
                                       costoUsd, latenciaMs, hashFoto, estado, error)
    OUTPUT INSERTED.id AS id
    VALUES (:codigoTarea, :puerto, :idPrompt, :proveedor, :modelo, :tokensEntrada, :tokensSalida, :tokensCache,
            :costoUsd, :latenciaMs, :hashFoto, :estado, :error)`, {
    codigoTarea: e.codigoTarea, puerto: e.puerto || null, idPrompt: e.idPrompt ?? null, proveedor: e.proveedor, modelo: String(e.modelo).slice(0, 80),
    tokensEntrada: e.tokensEntrada ?? null, tokensSalida: e.tokensSalida ?? null, tokensCache: e.tokensCache ?? null,
    costoUsd: e.costoUsd ?? null, latenciaMs: e.latenciaMs ?? null, hashFoto: e.hashFoto || null,
    estado: e.estado, error: e.error ? String(e.error).slice(0, 1000) : null,
  });
  return fila?.id ?? null;
}

/** Llamadas hechas (no omitidas) y tokens del día, por puerto y tarea. */
async function usoDelDia(puerto, codigoTarea, desdeIso) {
  const [fila] = await ejecutar(`
    SELECT COUNT(*) AS llamadas,
           ISNULL(SUM(ISNULL(tokensEntrada, 0) + ISNULL(tokensSalida, 0) + ISNULL(tokensCache, 0)), 0) AS tokens
    FROM dbo.TCL_IAEjecuciones WITH (NOLOCK)
    WHERE puerto = :puerto AND codigoTarea = :codigoTarea AND fecha >= CAST(:desde AS DATETIME2(0))
      AND estado IN (N'OK', N'INVALIDA', N'ERROR')`, { puerto, codigoTarea, desde: sql(desdeIso) });
  return { llamadas: Number(fila?.llamadas) || 0, tokens: Number(fila?.tokens) || 0 };
}

async function promptActivo(codigoTarea) {
  const [fila] = await ejecutar(`
    SELECT TOP 1 id, codigoTarea, version, modelo, CAST(temperatura AS FLOAT) AS temperatura, maxTokens, sistema, esquemaSalida
    FROM dbo.TCL_IAPrompts WITH (NOLOCK) WHERE codigoTarea = :codigoTarea AND estado = N'ACTIVO' ORDER BY version DESC`, { codigoTarea });
  return fila || null;
}

const COLUMNAS_HALLAZGO = `id, idEjecucion, puerto, clase, tipo, entidad, severidad, CAST(confianza AS FLOAT) AS confianza,
  CAST(horizonteMinH AS FLOAT) AS horizonteMinH, CAST(horizonteMaxH AS FLOAT) AS horizonteMaxH, titulo, explicacion,
  accionSugerida, evidencia, estado, CONVERT(VARCHAR(19), vigenteHasta, 126) + 'Z' AS vigenteHasta, resultado,
  CONVERT(VARCHAR(19), fecha, 126) + 'Z' AS fecha`;

async function hallazgosVigentes(puerto, ahoraIso) {
  return ejecutar(`SELECT ${COLUMNAS_HALLAZGO} FROM dbo.TCL_IAHallazgos WITH (NOLOCK)
    WHERE puerto = :puerto AND estado IN (N'PROPUESTO', N'PUBLICADO', N'CONFIRMADO') AND clase = N'ALERTA'
      AND (vigenteHasta IS NULL OR vigenteHasta >= CAST(:ahora AS DATETIME2(0)))`, { puerto, ahora: sql(ahoraIso) });
}

const valoresHallazgo = (h) => ({
  idEjecucion: h.idEjecucion ?? null, puerto: h.puerto, clase: h.clase, tipo: h.tipo, entidad: h.entidad ? String(h.entidad).slice(0, 120) : null,
  severidad: h.severidad || null, confianza: h.confianza ?? null, horizonteMinH: h.horizonteMinH ?? null, horizonteMaxH: h.horizonteMaxH ?? null,
  titulo: String(h.titulo).slice(0, 200), explicacion: h.explicacion ? String(h.explicacion).slice(0, 1000) : null,
  accionSugerida: h.accionSugerida ? String(h.accionSugerida).slice(0, 400) : null,
  evidencia: h.evidencia ? JSON.stringify(h.evidencia) : null, estado: h.estado, vigenteHasta: sql(h.vigenteHasta), resultado: h.resultado ? String(h.resultado).slice(0, 400) : null,
});

async function crearHallazgo(h) {
  const [fila] = await ejecutar(`
    INSERT INTO dbo.TCL_IAHallazgos (idEjecucion, puerto, clase, tipo, entidad, severidad, confianza, horizonteMinH, horizonteMaxH,
                                     titulo, explicacion, accionSugerida, evidencia, estado, vigenteHasta, resultado)
    OUTPUT INSERTED.id AS id
    VALUES (:idEjecucion, :puerto, :clase, :tipo, :entidad, :severidad, :confianza, :horizonteMinH, :horizonteMaxH,
            :titulo, :explicacion, :accionSugerida, :evidencia, :estado, CAST(:vigenteHasta AS DATETIME2(0)), :resultado)`, valoresHallazgo(h));
  return fila?.id ?? null;
}

/** Actualiza un hallazgo vigente con la nueva lectura del modelo (mismo tipo y entidad: no se duplica). */
async function actualizarHallazgo(id, h) {
  await ejecutar(`
    UPDATE dbo.TCL_IAHallazgos SET idEjecucion = :idEjecucion, severidad = :severidad, confianza = :confianza,
      horizonteMinH = :horizonteMinH, horizonteMaxH = :horizonteMaxH, titulo = :titulo, explicacion = :explicacion,
      accionSugerida = :accionSugerida, evidencia = :evidencia, estado = :estado, vigenteHasta = CAST(:vigenteHasta AS DATETIME2(0)),
      resultado = :resultado
    WHERE id = :id`, { ...valoresHallazgo(h), id }, QueryTypes.UPDATE);
}

async function hallazgos(puerto, { estado = null, desdeIso, limite = 100 }) {
  return ejecutar(`SELECT TOP (:limite) ${COLUMNAS_HALLAZGO} FROM dbo.TCL_IAHallazgos WITH (NOLOCK)
    WHERE puerto = :puerto AND fecha >= CAST(:desde AS DATETIME2(0)) AND (:estado IS NULL OR estado = :estado)
    ORDER BY fecha DESC`, { puerto, estado, desde: sql(desdeIso), limite });
}

/** Conteo de hallazgos por clase, tipo, severidad y estado (revisión del modo sombra). */
async function resumenHallazgos(puerto, desdeIso) {
  return ejecutar(`
    SELECT clase, tipo, severidad, estado, COUNT(*) AS cantidad, CAST(AVG(CAST(confianza AS FLOAT)) AS DECIMAL(4,2)) AS confianzaMedia
    FROM dbo.TCL_IAHallazgos WITH (NOLOCK)
    WHERE puerto = :puerto AND fecha >= CAST(:desde AS DATETIME2(0))
    GROUP BY clase, tipo, severidad, estado ORDER BY clase, tipo, severidad, estado`, { puerto, desde: sql(desdeIso) });
}

/** Uso por día (hora de Colombia), tarea y estado: llamadas, tokens, costo y latencia media. */
async function uso(desdeIso) {
  return ejecutar(`
    SELECT CONVERT(VARCHAR(10), DATEADD(HOUR, -5, fecha), 23) AS dia, codigoTarea, puerto, estado, COUNT(*) AS llamadas,
           ISNULL(SUM(tokensEntrada), 0) AS tokensEntrada, ISNULL(SUM(tokensSalida), 0) AS tokensSalida,
           ISNULL(SUM(tokensCache), 0) AS tokensCache, CAST(ISNULL(SUM(costoUsd), 0) AS DECIMAL(10,4)) AS costoUsd,
           AVG(latenciaMs) AS latenciaMediaMs
    FROM dbo.TCL_IAEjecuciones WITH (NOLOCK) WHERE fecha >= CAST(:desde AS DATETIME2(0))
    GROUP BY CONVERT(VARCHAR(10), DATEADD(HOUR, -5, fecha), 23), codigoTarea, puerto, estado
    ORDER BY dia DESC, codigoTarea, puerto, estado`, { desde: sql(desdeIso) });
}

// ── Fase 3: retroalimentación, panel y verificación ─────────────────────────────────────────────────────

async function obtenerHallazgo(id) {
  const [fila] = await ejecutar(`SELECT ${COLUMNAS_HALLAZGO} FROM dbo.TCL_IAHallazgos WITH (NOLOCK) WHERE id = :id`, { id });
  return fila || null;
}

async function cambiarEstado(id, estado) {
  await ejecutar('UPDATE dbo.TCL_IAHallazgos SET estado = :estado WHERE id = :id', { id, estado }, QueryTypes.UPDATE);
}

async function registrarFeedback({ idHallazgo, usuario, util, comentario }) {
  await ejecutar(`INSERT INTO dbo.TCL_IAFeedback (idHallazgo, usuario, util, comentario) VALUES (:idHallazgo, :usuario, :util, :comentario)`,
    { idHallazgo, usuario: String(usuario).slice(0, 200), util: util ? 1 : 0, comentario: comentario ? String(comentario).slice(0, 500) : null }, QueryTypes.INSERT);
}

/** Lo que muestra el widget: alertas y tendencias vigentes y el último resumen del turno. */
async function panel(puerto, ahoraIso) {
  const vigentes = await ejecutar(`SELECT ${COLUMNAS_HALLAZGO} FROM dbo.TCL_IAHallazgos WITH (NOLOCK)
    WHERE puerto = :puerto AND clase IN (N'ALERTA', N'TENDENCIA') AND estado IN (N'PROPUESTO', N'PUBLICADO', N'CONFIRMADO')
      AND vigenteHasta >= CAST(:ahora AS DATETIME2(0))
    ORDER BY CASE severidad WHEN N'critica' THEN 0 WHEN N'atencion' THEN 1 ELSE 2 END, fecha DESC`, { puerto, ahora: sql(ahoraIso) });
  const [resumen] = await ejecutar(`SELECT TOP 1 ${COLUMNAS_HALLAZGO} FROM dbo.TCL_IAHallazgos WITH (NOLOCK)
    WHERE puerto = :puerto AND clase = N'RESUMEN' AND tipo = N'resumen_turno' ORDER BY fecha DESC`, { puerto });   // el del analista; los cierres de turno van por /resumenes
  return { vigentes, resumen: resumen || null };
}

/** Alertas con el horizonte vencido que aún no tienen verificación (cierre del ciclo). */
async function porVerificar(ahoraIso, limite = 200) {
  return ejecutar(`SELECT TOP (:limite) ${COLUMNAS_HALLAZGO} FROM dbo.TCL_IAHallazgos WITH (NOLOCK)
    WHERE clase = N'ALERTA' AND estado IN (N'PROPUESTO', N'PUBLICADO', N'CONFIRMADO', N'FALSO')
      AND vigenteHasta < CAST(:ahora AS DATETIME2(0)) AND (resultado IS NULL OR resultado NOT LIKE N'VERIFICACION:%')
    ORDER BY vigenteHasta`, { ahora: sql(ahoraIso), limite });
}

async function guardarVerificacion(id, texto) {
  await ejecutar(`UPDATE dbo.TCL_IAHallazgos SET resultado = LEFT(:texto, 400) WHERE id = :id`, { id, texto }, QueryTypes.UPDATE);
}

/** Precisión por tipo: verificación automática y votos de los usuarios. */
async function precision(puerto, desdeIso) {
  return ejecutar(`
    SELECT h.tipo,
           COUNT(*) AS alertas,
           SUM(CASE WHEN h.estado = N'PUBLICADO' OR h.estado = N'CONFIRMADO' OR h.estado = N'FALSO' THEN 1 ELSE 0 END) AS publicadas,
           SUM(CASE WHEN h.resultado LIKE N'VERIFICACION: SE_CUMPLIO%' THEN 1 ELSE 0 END) AS seCumplieron,
           SUM(CASE WHEN h.resultado LIKE N'VERIFICACION: NO_SE_CUMPLIO%' THEN 1 ELSE 0 END) AS noSeCumplieron,
           SUM(ISNULL(f.utiles, 0)) AS votosUtiles, SUM(ISNULL(f.noEra, 0)) AS votosNoEra,
           CAST(AVG(CAST(h.horizonteMinH AS FLOAT)) AS DECIMAL(5,1)) AS anticipacionMinMediaH
    FROM dbo.TCL_IAHallazgos h WITH (NOLOCK)
    OUTER APPLY (SELECT SUM(CASE WHEN util = 1 THEN 1 ELSE 0 END) AS utiles, SUM(CASE WHEN util = 0 THEN 1 ELSE 0 END) AS noEra
                 FROM dbo.TCL_IAFeedback fb WITH (NOLOCK) WHERE fb.idHallazgo = h.id) f
    WHERE h.puerto = :puerto AND h.clase = N'ALERTA' AND h.estado <> N'DESCARTADO' AND h.fecha >= CAST(:desde AS DATETIME2(0))
    GROUP BY h.tipo ORDER BY h.tipo`, { puerto, desde: sql(desdeIso) });
}

module.exports = {
  obtenerHallazgo, cambiarEstado, registrarFeedback, panel, porVerificar, guardarVerificacion, precision,
  registrarEjecucion, usoDelDia, promptActivo, hallazgosVigentes, crearHallazgo, actualizarHallazgo,
  hallazgos, resumenHallazgos, uso, MIGRACION_015,
};
