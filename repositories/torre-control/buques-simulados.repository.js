/*
    Author: German Valencia
    Pattern: PORTTOS Repository - Buques simulados (OT-009, migraciones 021 y 022)
    Description: Lecturas y escrituras del simulador de buques (utils/simulador-buques.js) en las mismas tablas que llena el
      AIS y DIMAR: TCL_AisUltimaPosicion, TCL_EventosEstadoNave, TCL_NavesAvisadas, el line-up (TCL_LineUpMaritimo) y, con la
      migración 023, TCL_ProductividadTerminales y TCL_ReportesOperativos, con fuente = 'SIMULADOR' y simulado = 1.
      Lo real no se toca: todas las escrituras filtran simulado = 1. Sin la 021 lanza migracionPendiente; sin la 022 el punto
      de fondeo sale null (las fondeadas no se dibujan, pero cuentan).
*/
const { QueryTypes } = require('sequelize');
const { db } = require('../../database/connection');
const { esColumnaInexistente, esTablaInexistente, migracionPendiente } = require('../../helpers/errores.helper');

const MIGRACION_021 = '021_fuente_simulado_tablas_operacion.sql';
const LOTE = 60;

async function q(sql, replacements = {}, type = QueryTypes.SELECT, opciones = {}) {
  try {
    return await db.sequelize.query(sql, { replacements, type, ...opciones });
  } catch (error) {
    if (esColumnaInexistente(error) || esTablaInexistente(error)) throw migracionPendiente(MIGRACION_021);
    throw error;
  }
}

/** INSERT por lotes con replacements (columnas fijas + valores de cada fila). */
async function insertar(tabla, columnas, filas, valor, transaction) {
  for (let i = 0; i < filas.length; i += LOTE) {
    const replacements = {};
    const valores = filas.slice(i, i + LOTE).map((f, j) => '(' + columnas.map((c) => {
      replacements[c + '_' + j] = valor(f, c);
      return ':' + c + '_' + j;
    }).join(', ') + ')');
    await q(`INSERT INTO dbo.${tabla} (${columnas.join(', ')}) VALUES ${valores.join(',\n')}`, replacements, QueryTypes.INSERT, { transaction });
  }
}

/** ¿Hay line-up real del puerto con ETA en la ventana? 'puerto' es el nombre del maestro (el line-up guarda nombres). */
async function hayLineUpReal(nombrePuerto, desdeIso, hastaIso) {
  const [f] = await q(`
    SELECT COUNT(1) AS n FROM dbo.TCL_LineUpMaritimo WITH (NOLOCK)
    WHERE REPLACE(UPPER(puerto), ' ', '_') COLLATE Latin1_General_CI_AI = REPLACE(UPPER(:puerto), ' ', '_') AND simulado = 0
      AND COALESCE(estadoRegistro, 1) = 1
      AND TRY_CONVERT(DATETIMEOFFSET, eta, 127) BETWEEN TRY_CONVERT(DATETIMEOFFSET, :desde, 127) AND TRY_CONVERT(DATETIMEOFFSET, :hasta, 127)`,
  { puerto: nombrePuerto, desde: desdeIso, hasta: hastaIso });
  return Number(f?.n || 0) > 0;
}

/** ¿Hay productividad real (simulado = 0) del puerto desde ayer? */
async function hayProductividadReal(idPuerto, desdeFecha) {
  const [f] = await q(`SELECT COUNT(1) AS n FROM dbo.TCL_ProductividadTerminales WITH (NOLOCK)
    WHERE puerto = :idPuerto AND simulado = 0 AND fecha >= :desde`, { idPuerto, desde: desdeFecha });
  return Number(f?.n || 0) > 0;
}

/** ¿Hay reportes operativos reales (simulado = 0) del puerto desde 'desdeIso'? (fecha_registro es texto 'AAAA-MM-DD HH:mm:ss') */
async function hayReportesReales(idPuerto, desdeIso) {
  const [f] = await q(`SELECT COUNT(1) AS n FROM dbo.TCL_ReportesOperativos WITH (NOLOCK)
    WHERE REPLACE(UPPER(puerto), ' ', '_') COLLATE Latin1_General_CI_AI = REPLACE(UPPER(:idPuerto), ' ', '_') AND simulado = 0
      AND TRY_CONVERT(DATETIME2, REPLACE(REPLACE(fecha_registro, 'T', ' '), 'Z', '')) >= TRY_CONVERT(DATETIME2, REPLACE(REPLACE(:desde, 'T', ' '), 'Z', ''))`,
  { idPuerto, desde: desdeIso });
  return Number(f?.n || 0) > 0;
}

/** Punto de fondeo (022) y capitanía del puerto; sin la 022, fondeo null. */
async function puerto(idPuerto) {
  const consulta = (conFondeo) => db.sequelize.query(`
    SELECT TOP (1) capitania_dimar AS capitania
           ${conFondeo ? ', fondeo_geo.STY AS lat, fondeo_geo.STX AS lon' : ''}
    FROM dbo.TCL_MaestroPuertos WHERE id_puerto = :idPuerto`, { replacements: { idPuerto }, type: QueryTypes.SELECT });
  let fila;
  try { [fila] = await consulta(true); } catch (error) {
    if (!esColumnaInexistente(error)) throw error;
    [fila] = await consulta(false);
  }
  return {
    capitania: fila?.capitania || null,
    fondeo: fila && fila.lat !== null && fila.lat !== undefined ? { lat: Number(fila.lat), lon: Number(fila.lon) } : null,
  };
}

/** Muelles activos del puerto con su punto (ubicación o centro de la geocerca). */
function muelles(idPuerto) {
  return q(`
    SELECT m.id_terminal AS idTerminal, t.nombre AS terminal, m.codigo_muelle AS codigoMuelle, m.especialidad,
           COALESCE(m.ubicacion_geo.STY, m.geocerca_geo.STEnvelope().STCentroid().STY) AS lat,
           COALESCE(m.ubicacion_geo.STX, m.geocerca_geo.STEnvelope().STCentroid().STX) AS lon
    FROM dbo.TCL_MaestroMuelles m
    INNER JOIN dbo.TCL_MaestroTerminales t ON t.id_terminal = m.id_terminal
    WHERE t.id_puerto = :idPuerto AND ISNULL(t.estado, 1) = 1 AND ISNULL(m.estado, 1) = 1 AND ISNULL(m.estado_mantenimiento, 0) = 0
    ORDER BY t.id_terminal, m.codigo_muelle`, { idPuerto });
}

/** ¿Hay posiciones AIS reales (simulado = 0) del puerto en las últimas 'horas'? */
async function hayAisReal(idPuerto, horas) {
  const [f] = await q(`
    SELECT COUNT(1) AS n FROM dbo.TCL_AisUltimaPosicion WITH (NOLOCK)
    WHERE id_puerto = :idPuerto AND simulado = 0
      AND TRY_CONVERT(DATETIMEOFFSET, fechaModificacion, 127) >= DATEADD(HOUR, :horasNeg, SYSDATETIMEOFFSET())`,
  { idPuerto, horasNeg: -Math.abs(horas) });
  return Number(f?.n || 0) > 0;
}

/** ¿Hay avisos DIMAR reales de la capitanía con ETA en la ventana? */
async function hayAvisosReales(capitania, desdeIso, hastaIso) {
  if (!capitania) return false;
  const [f] = await q(`
    SELECT COUNT(1) AS n FROM dbo.TCL_NavesAvisadas WITH (NOLOCK)
    WHERE capitania COLLATE Latin1_General_CI_AI = :capitania AND simulado = 0
      AND TRY_CONVERT(DATETIMEOFFSET, eta, 127) BETWEEN TRY_CONVERT(DATETIMEOFFSET, :desde, 127) AND TRY_CONVERT(DATETIMEOFFSET, :hasta, 127)`,
  { capitania, desde: desdeIso, hasta: hastaIso });
  return Number(f?.n || 0) > 0;
}

const COL_AIS = ['mmsi', 'nombre_motonave', 'latitud', 'longitud', 'velocidad', 'rumbo', 'destino', 'estado_inferido', 'estado_nav_ais',
  'id_puerto', 'id_terminal', 'codigo_muelle', 'fecha_cambio_estado', 'codigoUsuarioCreacion', 'fechaCreacion', 'fechaModificacion', 'fuente', 'simulado'];
const COL_EVENTOS = ['mmsi', 'nombre_motonave', 'estado_anterior', 'estado_nuevo', 'id_puerto', 'id_terminal', 'codigo_muelle',
  'duracion_anterior_min', 'codigoUsuarioCreacion', 'fecha_evento', 'fuente', 'simulado'];
const COL_LINEUP = ['puerto', 'terminal', 'muelle', 'motonave', 'lineaAgencia', 'viaje', 'eslora', 'eta', 'fechaAtraque', 'fechaZarpe',
  'trabajoOperacion', 'posicion', 'novedades', 'estadoRegistro', 'codigoUsuarioCreacion', 'fechaCreacion', 'fuente', 'simulado'];
const COL_PRODUCTIVIDAD = ['puerto', 'terminal', 'fecha', 'hora_etiqueta', 'movimientos_hora', 'codigoUsuarioCreacion', 'fechaCreacion', 'fuente', 'simulado'];
const COL_REPORTES = ['puerto', 'titulo', 'fecha_evento', 'descripcion', 'tipo_color', 'fecha_registro', 'icono', 'fuente', 'simulado'];
const COL_AVISOS = ['capitania', 'id_aviso', 'omi', 'motonave', 'bandera', 'eta', 'tipo_nave', 'eslora', 'calado', 'agencia',
  'instalacion_portuaria', 'id_puerto', 'id_terminal', 'usuario_cargue', 'fecha_cargue', 'fuente', 'simulado'];

/**
 * Cambia lo simulado del puerto por lo nuevo (una transacción). Partes ausentes (null) no se tocan.
 * @param {{ posiciones?, eventos?, avisos?, lineUp?, productividad?, reportes?: object[]|null }} datos
 *   productividad y reportes se guardan con el id del puerto en 'puerto' (así los guarda la ingesta)
 * @param {string} [nombrePuerto]  nombre del maestro: así lo guarda y lo busca el line-up
 */
function reemplazar(idPuerto, { posiciones = null, eventos = null, avisos = null, lineUp = null, productividad = null, reportes = null },
  ahoraIso, nombrePuerto = idPuerto) {
  const fijos = { id_puerto: idPuerto, puerto: nombrePuerto, estadoRegistro: 1, codigoUsuarioCreacion: 'SIMULADOR', usuario_cargue: 'SIMULADOR', fechaCreacion: ahoraIso,
    fechaModificacion: ahoraIso, fecha_cargue: ahoraIso, fuente: 'SIMULADOR', simulado: 1 };
  const valor = (f, c) => (c in fijos ? fijos[c] : f[c] === undefined ? null : f[c]);
  return db.sequelize.transaction(async (transaction) => {
    let n = 0;
    if (posiciones) {
      await q('DELETE FROM dbo.TCL_AisUltimaPosicion WHERE id_puerto = :idPuerto AND simulado = 1', { idPuerto }, QueryTypes.DELETE, { transaction });
      await insertar('TCL_AisUltimaPosicion', COL_AIS, posiciones, valor, transaction);
      n += posiciones.length;
    }
    if (eventos) {
      await q('DELETE FROM dbo.TCL_EventosEstadoNave WHERE id_puerto = :idPuerto AND simulado = 1', { idPuerto }, QueryTypes.DELETE, { transaction });
      await insertar('TCL_EventosEstadoNave', COL_EVENTOS, eventos, valor, transaction);
      n += eventos.length;
    }
    if (avisos) {
      await q('DELETE FROM dbo.TCL_NavesAvisadas WHERE id_puerto = :idPuerto AND simulado = 1', { idPuerto }, QueryTypes.DELETE, { transaction });
      await insertar('TCL_NavesAvisadas', COL_AVISOS, avisos, valor, transaction);
      n += avisos.length;
    }
    if (lineUp) {
      await q("DELETE FROM dbo.TCL_LineUpMaritimo WHERE puerto = :puerto AND simulado = 1", { puerto: nombrePuerto }, QueryTypes.DELETE, { transaction });
      await insertar('TCL_LineUpMaritimo', COL_LINEUP, lineUp, valor, transaction);
      n += lineUp.length;
    }
    const conId = (f, c) => (c === 'puerto' ? idPuerto : valor(f, c));
    if (productividad) {
      await q('DELETE FROM dbo.TCL_ProductividadTerminales WHERE puerto = :idPuerto AND simulado = 1', { idPuerto }, QueryTypes.DELETE, { transaction });
      await insertar('TCL_ProductividadTerminales', COL_PRODUCTIVIDAD, productividad, conId, transaction);
      n += productividad.length;
    }
    if (reportes) {
      await q('DELETE FROM dbo.TCL_ReportesOperativos WHERE puerto = :idPuerto AND simulado = 1', { idPuerto }, QueryTypes.DELETE, { transaction });
      await insertar('TCL_ReportesOperativos', COL_REPORTES, reportes, conId, transaction);
      n += reportes.length;
    }
    return n;
  });
}

/** Retira lo simulado del puerto: 'ais' (posiciones y eventos), 'avisos', 'lineUp' (por el nombre del maestro), 'productividad', 'reportes'. */
async function retirar(idPuerto, { ais = false, avisos = false, lineUp = false, productividad = false, reportes = false } = {}, nombrePuerto = idPuerto) {
  if (productividad) await q('DELETE FROM dbo.TCL_ProductividadTerminales WHERE puerto = :idPuerto AND simulado = 1', { idPuerto }, QueryTypes.DELETE);
  if (reportes) await q('DELETE FROM dbo.TCL_ReportesOperativos WHERE puerto = :idPuerto AND simulado = 1', { idPuerto }, QueryTypes.DELETE);
  if (lineUp) await q('DELETE FROM dbo.TCL_LineUpMaritimo WHERE puerto = :puerto AND simulado = 1', { puerto: nombrePuerto }, QueryTypes.DELETE);
  if (ais) {
    await q('DELETE FROM dbo.TCL_AisUltimaPosicion WHERE id_puerto = :idPuerto AND simulado = 1', { idPuerto }, QueryTypes.DELETE);
    await q('DELETE FROM dbo.TCL_EventosEstadoNave WHERE id_puerto = :idPuerto AND simulado = 1', { idPuerto }, QueryTypes.DELETE);
  }
  if (avisos) await q('DELETE FROM dbo.TCL_NavesAvisadas WHERE id_puerto = :idPuerto AND simulado = 1', { idPuerto }, QueryTypes.DELETE);
}

module.exports = { puerto, muelles, hayAisReal, hayAvisosReales, hayLineUpReal, hayProductividadReal, hayReportesReales, reemplazar, retirar };
