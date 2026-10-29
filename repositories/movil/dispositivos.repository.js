/*
    Author: German Valencia
    Pattern: PORTTOS Repository - Dispositivos móviles y envíos push (migración 019)
    Description:
      - registrar(d)                    alta o actualización por token (si el token ya era de otro usuario, pasa al nuevo)
      - baja(token, codigoUsuario)      deja de recibir (activo = 0); solo el dueño
      - deUsuario(codigoUsuario)        dispositivos activos del usuario (sus preferencias)
      - destinatarios()                 dispositivos activos cuya sesión sigue activa en PTLSesiones (una sola sesión por usuario)
      - yaEnviados(idsHallazgo)         pares hallazgo/dispositivo ya notificados (para no repetir)
      - registrarEnvio(e) · invalidar(id) · contarFallo(id)
    Sin la 019 lanza migracionPendiente('019_movil_push.sql').
*/
const { QueryTypes } = require('sequelize');
const { db } = require('../../database/connection');
const { esColumnaInexistente, esTablaInexistente, migracionPendiente } = require('../../helpers/errores.helper');

const MIGRACION_019 = '019_movil_push.sql';

async function ejecutar(texto, replacements = {}, type = QueryTypes.SELECT) {
  try {
    return await db.sequelize.query(texto, { replacements, type });
  } catch (error) {
    if (esTablaInexistente(error) || esColumnaInexistente(error) || /Invalid object name/i.test(error?.message || '')) throw migracionPendiente(MIGRACION_019);
    throw error;
  }
}

const CAMPOS = 'id, plataforma, codigoUsuario, codigoSesion, puertos, severidadMinima, idioma, activo, fechaRegistro, fechaModificacion';

async function registrar(d) {
  const [fila] = await ejecutar(`
    MERGE dbo.TCL_DispositivosMovil WITH (HOLDLOCK) AS t
    USING (SELECT :token AS token) AS s ON t.token = s.token
    WHEN MATCHED THEN UPDATE SET plataforma = :plataforma, codigoUsuario = :codigoUsuario, codigoSesion = :codigoSesion,
      puertos = :puertos, severidadMinima = :severidadMinima, idioma = :idioma, activo = 1, fallos = 0, fechaModificacion = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN INSERT (token, plataforma, codigoUsuario, codigoSesion, puertos, severidadMinima, idioma)
      VALUES (:token, :plataforma, :codigoUsuario, :codigoSesion, :puertos, :severidadMinima, :idioma)
    OUTPUT INSERTED.id AS id;`, d);
  return fila?.id ?? null;
}

async function baja(token, codigoUsuario) {
  const filas = await ejecutar(`
    UPDATE dbo.TCL_DispositivosMovil SET activo = 0, fechaModificacion = SYSUTCDATETIME()
    OUTPUT INSERTED.id AS id
    WHERE token = :token AND codigoUsuario = :codigoUsuario`, { token, codigoUsuario });
  return filas.length;
}

function deUsuario(codigoUsuario) {
  return ejecutar(`SELECT ${CAMPOS} FROM dbo.TCL_DispositivosMovil WHERE codigoUsuario = :codigoUsuario AND activo = 1 ORDER BY fechaModificacion DESC`, { codigoUsuario });
}

/** Solo los dispositivos cuya sesión es la activa del usuario (al entrar en otro equipo, el anterior deja de recibir). */
function destinatarios({ codigoUsuario = null } = {}) {
  return ejecutar(`
    SELECT d.id, d.token, d.plataforma, d.codigoUsuario, d.puertos, d.severidadMinima, d.idioma
    FROM dbo.TCL_DispositivosMovil d
    INNER JOIN dbo.PTLSesiones s ON s.codigoSesion = d.codigoSesion AND s.codigoUsuario = d.codigoUsuario AND s.activa = 1
    WHERE d.activo = 1 ${codigoUsuario ? 'AND d.codigoUsuario = :codigoUsuario' : ''}`, { codigoUsuario });
}

async function yaEnviados(idsHallazgo) {
  const ids = (idsHallazgo || []).map(Number).filter(Number.isFinite);
  if (!ids.length) return [];
  return ejecutar(`SELECT DISTINCT idHallazgo, idDispositivo FROM dbo.TCL_PushEnvios WHERE estado = N'ENVIADO' AND idHallazgo IN (:ids)`, { ids });
}

function registrarEnvio(e) {
  return ejecutar(`
    INSERT INTO dbo.TCL_PushEnvios (idDispositivo, idHallazgo, puerto, tipo, estado, error)
    VALUES (:idDispositivo, :idHallazgo, :puerto, :tipo, :estado, :error)`, {
    idDispositivo: e.idDispositivo, idHallazgo: e.idHallazgo ?? null, puerto: e.puerto || null, tipo: e.tipo,
    estado: e.estado, error: e.error ? String(e.error).slice(0, 300) : null,
  }, QueryTypes.INSERT);
}

function invalidar(id) {
  return ejecutar(`UPDATE dbo.TCL_DispositivosMovil SET activo = 0, fechaModificacion = SYSUTCDATETIME() WHERE id = :id`, { id }, QueryTypes.UPDATE);
}

/** Tres fallos seguidos (no de token) desactivan el dispositivo. */
function contarFallo(id) {
  return ejecutar(`UPDATE dbo.TCL_DispositivosMovil SET fallos = fallos + 1, activo = CASE WHEN fallos + 1 >= 3 THEN 0 ELSE activo END WHERE id = :id`, { id }, QueryTypes.UPDATE);
}

module.exports = { registrar, baja, deUsuario, destinatarios, yaEnviados, registrarEnvio, invalidar, contarFallo, MIGRACION_019 };
