/*
    Author: German Valencia
    Pattern: PORTTOS Repository - Administración de la capa de IA (TCL_IAConfig y TCL_IAPrompts)
    Description:
      - configuraciones()                     todas las filas de TCL_IAConfig (sirve antes y después de la 017)
      - guardarConfig(fila, usuario)          crea o actualiza la fila (puerto, tarea); NULL = hereda del .env (017)
      - prompts(tarea?) / obtenerPrompt(id)   versiones de prompt
      - crearPrompt(p, usuario) → id          nueva versión BORRADOR (versión = la mayor + 1)
      - cambiarEstadoPrompt(id, estado)       ACTIVO retira el que estaba activo en la misma tarea (una transacción)
    No borra filas: «restablecer» una configuración es dejar sus campos en NULL.
*/
const { QueryTypes } = require('sequelize');
const { db } = require('../../database/connection');
const { esColumnaInexistente, esTablaInexistente, migracionPendiente } = require('../../helpers/errores.helper');

async function ejecutar(texto, replacements = {}, type = QueryTypes.SELECT) {
  try {
    return await db.sequelize.query(texto, { replacements, type });
  } catch (error) {
    if (esTablaInexistente(error) || /Invalid object name/i.test(error?.message || '')) throw migracionPendiente('015_analisis_ia.sql');
    if (esColumnaInexistente(error) || /Cannot insert the value NULL/i.test(error?.message || '')) throw migracionPendiente('017_ia_resumenes_admin.sql');
    throw error;
  }
}

async function configuraciones() {
  return ejecutar(`SELECT *, CONVERT(VARCHAR(19), fechaModificacion, 126) + 'Z' AS fechaModificacionIso FROM dbo.TCL_IAConfig WITH (NOLOCK) ORDER BY puerto, codigoTarea`);
}

async function guardarConfig(f, usuario) {
  const valores = {
    puerto: f.puerto, codigoTarea: f.codigoTarea, activo: f.activo ?? null, modoSombra: f.modoSombra ?? null,
    topeTokensDia: f.topeTokensDia ?? null, topeLlamadasDia: f.topeLlamadasDia ?? null, confianzaMinima: f.confianzaMinima ?? null,
    tiposPublicar: f.tiposPublicar ?? null, usuario: String(usuario || 'desconocido').slice(0, 200),
  };
  await ejecutar(`
    MERGE dbo.TCL_IAConfig AS d
    USING (SELECT :puerto AS puerto, :codigoTarea AS codigoTarea) AS s ON d.puerto = s.puerto AND d.codigoTarea = s.codigoTarea
    WHEN MATCHED THEN UPDATE SET activo = :activo, modoSombra = :modoSombra, topeTokensDia = :topeTokensDia,
      topeLlamadasDia = :topeLlamadasDia, confianzaMinima = :confianzaMinima, tiposPublicar = :tiposPublicar,
      fechaModificacion = SYSUTCDATETIME(), modificadoPor = :usuario
    WHEN NOT MATCHED THEN INSERT (puerto, codigoTarea, activo, modoSombra, topeTokensDia, topeLlamadasDia, confianzaMinima, tiposPublicar, fechaModificacion, modificadoPor)
      VALUES (:puerto, :codigoTarea, :activo, :modoSombra, :topeTokensDia, :topeLlamadasDia, :confianzaMinima, :tiposPublicar, SYSUTCDATETIME(), :usuario);`,
  valores, QueryTypes.UPSERT);
}

const COLUMNAS_PROMPT = `id, codigoTarea, version, estado, modelo, CAST(temperatura AS FLOAT) AS temperatura, maxTokens, sistema, ejemplos,
  esquemaSalida, nota, creadoPor, CONVERT(VARCHAR(19), fechaCreacion, 126) + 'Z' AS fechaCreacion`;

async function prompts(tarea = null) {
  return ejecutar(`SELECT ${COLUMNAS_PROMPT} FROM dbo.TCL_IAPrompts WITH (NOLOCK)
    WHERE (:tarea IS NULL OR codigoTarea = :tarea) ORDER BY codigoTarea, version DESC`, { tarea });
}

async function obtenerPrompt(id) {
  const [fila] = await ejecutar(`SELECT ${COLUMNAS_PROMPT} FROM dbo.TCL_IAPrompts WITH (NOLOCK) WHERE id = :id`, { id });
  return fila || null;
}

async function crearPrompt(p, usuario) {
  const [fila] = await ejecutar(`
    DECLARE @version INT = (SELECT ISNULL(MAX(version), 0) + 1 FROM dbo.TCL_IAPrompts WITH (UPDLOCK, HOLDLOCK) WHERE codigoTarea = :codigoTarea);
    INSERT INTO dbo.TCL_IAPrompts (codigoTarea, version, estado, modelo, temperatura, maxTokens, sistema, ejemplos, esquemaSalida, nota, creadoPor)
    OUTPUT INSERTED.id AS id, INSERTED.version AS version
    VALUES (:codigoTarea, @version, N'BORRADOR', :modelo, :temperatura, :maxTokens, :sistema, :ejemplos, :esquemaSalida, :nota, :usuario);`, {
    codigoTarea: p.codigoTarea, modelo: p.modelo, temperatura: p.temperatura, maxTokens: p.maxTokens, sistema: p.sistema,
    ejemplos: p.ejemplos ? JSON.stringify(p.ejemplos) : null, esquemaSalida: p.esquemaSalida, nota: p.nota || null,
    usuario: String(usuario || 'desconocido').slice(0, 200),
  });
  return fila || null;
}

async function cambiarEstadoPrompt(id, estado) {
  await ejecutar(`
    SET XACT_ABORT ON;
    BEGIN TRANSACTION;
    IF :estado = N'ACTIVO'
      UPDATE dbo.TCL_IAPrompts SET estado = N'RETIRADO'
      WHERE estado = N'ACTIVO' AND id <> :id AND codigoTarea = (SELECT codigoTarea FROM dbo.TCL_IAPrompts WHERE id = :id);
    UPDATE dbo.TCL_IAPrompts SET estado = :estado WHERE id = :id;
    COMMIT TRANSACTION;`, { id, estado }, QueryTypes.UPDATE);
}

module.exports = { configuraciones, guardarConfig, prompts, obtenerPrompt, crearPrompt, cambiarEstadoPrompt };
