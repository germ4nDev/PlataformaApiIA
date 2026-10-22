/*
    Author: German Valencia
    Pattern: PORTTOS Repository - Operación portuaria (migración 013)
    Description: Lecturas y escrituras de TCL_OperacionesBuque, TCL_AvanceOperacionBuque, TCL_EquiposPortuarios,
      TCL_CargaSuelta y TCL_InventarioVehiculos, más el histórico mensual de Supertransporte.
      Las escrituras son upsert por la clave natural (id_puerto + codigo_externo / codigo_equipo / folio...), así la
      ingesta de una terminal puede reenviar el mismo dato sin duplicar.
      Sin la migración 013 lanza migracionPendiente (503).
*/
const { QueryTypes } = require('sequelize');
const { db } = require('../../database/connection');
const { esColumnaInexistente, esTablaInexistente, migracionPendiente } = require('../../helpers/errores.helper');

const MIGRACION_013 = '013_granel_suelta_capacidad_noticias.sql';

async function q(sql, replacements = {}, type = QueryTypes.SELECT, opciones = {}) {
  try {
    return await db.sequelize.query(sql, { replacements, type, ...opciones });
  } catch (error) {
    if (esTablaInexistente(error) || esColumnaInexistente(error) || /Invalid object name/i.test(error?.message || '')) {
      throw migracionPendiente(MIGRACION_013);
    }
    throw error;
  }
}

const COLUMNAS_OPERACION = `id_operacion, id_puerto, id_terminal, terminal, codigo_muelle, motonave, mmsi, naviera, segmento, tipo,
  producto, sentido, unidad, CAST(cantidad_total AS FLOAT) AS cantidad_total, CAST(cantidad_operada AS FLOAT) AS cantidad_operada,
  eta, fecha_inicio, fecha_fin_estimada, fecha_fin, estado, codigo_externo, fuente, CAST(simulado AS INT) AS simulado`;

/** Operaciones de buque del segmento: activas y las terminadas desde 'terminadasDesde'. */
const operaciones = (idPuerto, segmento, terminadasDesde) => q(`
  SELECT ${COLUMNAS_OPERACION}
  FROM dbo.TCL_OperacionesBuque WITH (NOLOCK)
  WHERE id_puerto = :idPuerto AND segmento = :segmento
    AND (estado <> 'TERMINADA' OR fecha_fin >= :terminadasDesde)`, { idPuerto, segmento, terminadasDesde });

/** Avance por hora del segmento desde la fecha ISO dada. */
const avance = (idPuerto, segmento, desde) => q(`
  SELECT id_operacion, hora, CAST(cantidad AS FLOAT) AS cantidad
  FROM dbo.TCL_AvanceOperacionBuque WITH (NOLOCK)
  WHERE id_puerto = :idPuerto AND segmento = :segmento AND hora >= :desde
  ORDER BY hora`, { idPuerto, segmento, desde });

const equipos = (idPuerto, segmentos) => q(`
  SELECT id, codigo_equipo, tipo, descripcion, terminal, segmento, CAST(capacidad_tmh AS FLOAT) AS capacidad_tmh,
         CAST(capacidad_ton AS FLOAT) AS capacidad_ton, estado, id_operacion, folio_carga_suelta, motonave, producto,
         CAST(rendimiento_tmh AS FLOAT) AS rendimiento_tmh, fuente, CAST(simulado AS INT) AS simulado, fechaModificacion
  FROM dbo.TCL_EquiposPortuarios WITH (NOLOCK)
  WHERE id_puerto = :idPuerto AND segmento IN (:segmentos)`, { idPuerto, segmentos });

/** Folios de carga suelta: activos y los despachados desde 'despachadosDesde'. */
const folios = (idPuerto, despachadosDesde) => q(`
  SELECT id, folio, clase, producto, cliente, motonave, naviera, terminal, sentido, bultos, bultos_recibidos,
         CAST(tm AS FLOAT) AS tm, CAST(peso_unitario_tm AS FLOAT) AS peso_unitario_tm, dimensiones, equipo_requerido, ubicacion,
         CAST(requiere_permiso AS INT) AS requiere_permiso, CAST(permiso_aprobado AS INT) AS permiso_aprobado, estado,
         fecha_programada, codigo_externo, fuente, CAST(simulado AS INT) AS simulado, fechaModificacion
  FROM dbo.TCL_CargaSuelta WITH (NOLOCK)
  WHERE id_puerto = :idPuerto AND (estado <> 'DESPACHADO' OR fechaModificacion >= :despachadosDesde)`, { idPuerto, despachadosDesde });

const vehiculos = (idPuerto) => q(`
  SELECT id_nodo, marca, flujo, unidades, CAST(dias_promedio AS FLOAT) AS dias_promedio, fecha_corte, fuente, CAST(simulado AS INT) AS simulado
  FROM dbo.TCL_InventarioVehiculos WITH (NOLOCK)
  WHERE id_puerto = :idPuerto AND unidades > 0`, { idPuerto });

/** Toneladas mensuales de Supertransporte de la zona portuaria (últimos 'anios' años). */
const historico = (zona, desdeAnio) => q(`
  SELECT anio, mes, UPPER(LTRIM(RTRIM(tipo_carga))) AS tipo_carga, SUM(CAST(total_toneladas AS FLOAT)) AS toneladas
  FROM dbo.TCL_HistoricosSupertransporte WITH (NOLOCK)
  WHERE UPPER(zona_portuaria) LIKE :zona AND anio >= :desdeAnio
  GROUP BY anio, mes, UPPER(LTRIM(RTRIM(tipo_carga)))`, { zona: `%${String(zona || '').toUpperCase()}%`, desdeAnio })
  .catch(() => []);   // la tabla de Supertransporte es de otra carga: si falta, el histórico sale vacío

/** id_operacion y segmento de las operaciones con esos códigos externos. */
const idsOperacion = (idPuerto, codigos) => (codigos.length ? q(`
  SELECT id_operacion, codigo_externo, segmento FROM dbo.TCL_OperacionesBuque WITH (NOLOCK)
  WHERE id_puerto = :idPuerto AND codigo_externo IN (:codigos)`, { idPuerto, codigos }) : Promise.resolve([]));

// ── Escrituras ────────────────────────────────────────────────────────────────

/** Upsert de una operación de buque por (id_puerto, codigo_externo). Devuelve el id_operacion. */
async function guardarOperacion(o, ahora) {
  const filas = await q(`
    MERGE dbo.TCL_OperacionesBuque AS d
    USING (SELECT :id_puerto AS id_puerto, :codigo_externo AS codigo_externo) AS s
      ON d.id_puerto = s.id_puerto AND d.codigo_externo = s.codigo_externo
    WHEN MATCHED THEN UPDATE SET id_terminal = :id_terminal, terminal = :terminal, codigo_muelle = :codigo_muelle,
      motonave = :motonave, mmsi = :mmsi, naviera = :naviera, segmento = :segmento, tipo = :tipo, producto = :producto,
      sentido = :sentido, unidad = :unidad, cantidad_total = :cantidad_total, cantidad_operada = :cantidad_operada,
      eta = :eta, fecha_inicio = :fecha_inicio, fecha_fin_estimada = :fecha_fin_estimada, fecha_fin = :fecha_fin,
      estado = :estado, fuente = :fuente, simulado = :simulado, fechaModificacion = :ahora
    WHEN NOT MATCHED THEN INSERT (id_puerto, id_terminal, terminal, codigo_muelle, motonave, mmsi, naviera, segmento, tipo,
      producto, sentido, unidad, cantidad_total, cantidad_operada, eta, fecha_inicio, fecha_fin_estimada, fecha_fin, estado,
      codigo_externo, fuente, simulado, fechaCreacion, fechaModificacion)
      VALUES (:id_puerto, :id_terminal, :terminal, :codigo_muelle, :motonave, :mmsi, :naviera, :segmento, :tipo, :producto,
      :sentido, :unidad, :cantidad_total, :cantidad_operada, :eta, :fecha_inicio, :fecha_fin_estimada, :fecha_fin, :estado,
      :codigo_externo, :fuente, :simulado, :ahora, :ahora)
    OUTPUT inserted.id_operacion;`, {
    id_terminal: null, terminal: null, codigo_muelle: null, mmsi: null, naviera: null, producto: null, sentido: 'IMPORTACION',
    cantidad_operada: 0, eta: null, fecha_inicio: null, fecha_fin_estimada: null, fecha_fin: null, ...o,
    simulado: o.simulado ? 1 : 0, ahora,
  });
  return filas[0]?.id_operacion;
}

/**
 * Avance por hora. modo 'reemplazar' (ingesta: la terminal manda el total de la hora) o 'sumar' (simulador).
 * filas: [{ id_operacion, id_puerto, segmento, hora, cantidad, fuente, simulado }]
 */
async function guardarAvance(filas, modo = 'reemplazar') {
  for (const f of filas) {
    await q(`
      MERGE dbo.TCL_AvanceOperacionBuque AS d
      USING (SELECT :id_operacion AS id_operacion, :hora AS hora) AS s ON d.id_operacion = s.id_operacion AND d.hora = s.hora
      WHEN MATCHED THEN UPDATE SET cantidad = ${modo === 'sumar' ? 'd.cantidad + ' : ''}:cantidad, fuente = :fuente, simulado = :simulado
      WHEN NOT MATCHED THEN INSERT (id_operacion, id_puerto, segmento, hora, cantidad, fuente, simulado)
        VALUES (:id_operacion, :id_puerto, :segmento, :hora, :cantidad, :fuente, :simulado);`,
    { ...f, simulado: f.simulado ? 1 : 0 }, QueryTypes.UPSERT);
  }
  return filas.length;
}

async function guardarEquipo(e, ahora) {
  await q(`
    MERGE dbo.TCL_EquiposPortuarios AS d
    USING (SELECT :id_puerto AS id_puerto, :codigo_equipo AS codigo_equipo) AS s
      ON d.id_puerto = s.id_puerto AND d.codigo_equipo = s.codigo_equipo
    WHEN MATCHED THEN UPDATE SET tipo = :tipo, descripcion = :descripcion, terminal = :terminal, segmento = :segmento,
      capacidad_tmh = :capacidad_tmh, capacidad_ton = :capacidad_ton, estado = :estado, id_operacion = :id_operacion,
      folio_carga_suelta = :folio_carga_suelta, motonave = :motonave, producto = :producto, rendimiento_tmh = :rendimiento_tmh,
      fuente = :fuente, simulado = :simulado, fechaModificacion = :ahora
    WHEN NOT MATCHED THEN INSERT (id_puerto, codigo_equipo, tipo, descripcion, terminal, segmento, capacidad_tmh, capacidad_ton,
      estado, id_operacion, folio_carga_suelta, motonave, producto, rendimiento_tmh, fuente, simulado, fechaModificacion)
      VALUES (:id_puerto, :codigo_equipo, :tipo, :descripcion, :terminal, :segmento, :capacidad_tmh, :capacidad_ton, :estado,
      :id_operacion, :folio_carga_suelta, :motonave, :producto, :rendimiento_tmh, :fuente, :simulado, :ahora);`, {
    descripcion: null, terminal: null, capacidad_tmh: null, capacidad_ton: null, id_operacion: null, folio_carga_suelta: null,
    motonave: null, producto: null, rendimiento_tmh: null, ...e, simulado: e.simulado ? 1 : 0, ahora,
  }, QueryTypes.UPSERT);
}

async function guardarFolio(f, ahora) {
  await q(`
    MERGE dbo.TCL_CargaSuelta AS d
    USING (SELECT :id_puerto AS id_puerto, :codigo_externo AS codigo_externo) AS s
      ON d.id_puerto = s.id_puerto AND d.codigo_externo = s.codigo_externo
    WHEN MATCHED THEN UPDATE SET folio = :folio, clase = :clase, producto = :producto, cliente = :cliente, motonave = :motonave,
      naviera = :naviera, terminal = :terminal, sentido = :sentido, bultos = :bultos, bultos_recibidos = :bultos_recibidos, tm = :tm,
      peso_unitario_tm = :peso_unitario_tm, dimensiones = :dimensiones, equipo_requerido = :equipo_requerido, ubicacion = :ubicacion,
      requiere_permiso = :requiere_permiso, permiso_aprobado = :permiso_aprobado, estado = :estado,
      fecha_programada = :fecha_programada, fuente = :fuente, simulado = :simulado, fechaModificacion = :ahora
    WHEN NOT MATCHED THEN INSERT (id_puerto, folio, clase, producto, cliente, motonave, naviera, terminal, sentido, bultos,
      bultos_recibidos, tm, peso_unitario_tm, dimensiones, equipo_requerido, ubicacion, requiere_permiso, permiso_aprobado, estado,
      fecha_programada, codigo_externo, fuente, simulado, fechaCreacion, fechaModificacion)
      VALUES (:id_puerto, :folio, :clase, :producto, :cliente, :motonave, :naviera, :terminal, :sentido, :bultos,
      :bultos_recibidos, :tm, :peso_unitario_tm, :dimensiones, :equipo_requerido, :ubicacion, :requiere_permiso, :permiso_aprobado,
      :estado, :fecha_programada, :codigo_externo, :fuente, :simulado, :ahora, :ahora);`, {
    cliente: null, motonave: null, naviera: null, terminal: null, sentido: 'IMPORTACION', bultos: null, bultos_recibidos: null, tm: null,
    peso_unitario_tm: null, dimensiones: null, equipo_requerido: null, ubicacion: null, permiso_aprobado: null, fecha_programada: null,
    ...f, requiere_permiso: f.requiere_permiso ? 1 : 0,
    permiso_aprobado: f.permiso_aprobado === null || f.permiso_aprobado === undefined ? null : (f.permiso_aprobado ? 1 : 0),
    simulado: f.simulado ? 1 : 0, ahora,
  }, QueryTypes.UPSERT);
}

async function guardarVehiculos(v) {
  await q(`
    MERGE dbo.TCL_InventarioVehiculos AS d
    USING (SELECT :id_puerto AS id_puerto, :id_nodo AS id_nodo, :marca AS marca, :flujo AS flujo) AS s
      ON d.id_puerto = s.id_puerto AND d.id_nodo = s.id_nodo AND d.marca = s.marca AND d.flujo = s.flujo
    WHEN MATCHED THEN UPDATE SET unidades = :unidades, dias_promedio = :dias_promedio, fecha_corte = :fecha_corte,
      fuente = :fuente, simulado = :simulado
    WHEN NOT MATCHED THEN INSERT (id_puerto, id_nodo, marca, flujo, unidades, dias_promedio, fecha_corte, fuente, simulado)
      VALUES (:id_puerto, :id_nodo, :marca, :flujo, :unidades, :dias_promedio, :fecha_corte, :fuente, :simulado);`,
  { dias_promedio: null, ...v, simulado: v.simulado ? 1 : 0 }, QueryTypes.UPSERT);
}

/** ¿Hubo datos que no son del simulador en la tabla desde la fecha dada? (el simulador cede el puerto). */
async function hayDatosReales(tabla, idPuerto, desde) {
  const campos = {
    TCL_OperacionesBuque: 'fechaModificacion', TCL_CargaSuelta: 'fechaModificacion', TCL_InventarioVehiculos: 'fecha_corte',
    TCL_EquiposPortuarios: 'fechaModificacion',
  };
  if (!campos[tabla]) throw new Error(`Tabla no prevista: ${tabla}`);
  const [f] = await q(`SELECT COUNT(*) AS n FROM dbo.${tabla} WITH (NOLOCK)
                       WHERE id_puerto = :idPuerto AND simulado = 0 AND ${campos[tabla]} >= :desde`, { idPuerto, desde });
  return Number(f?.n) > 0;
}

/** Retención: avance y operaciones/folios terminados de más de 'antes'. */
async function purgar(antes) {
  await q(`DELETE FROM dbo.TCL_AvanceOperacionBuque WHERE hora < :antes`, { antes }, QueryTypes.DELETE);
  await q(`DELETE FROM dbo.TCL_OperacionesBuque WHERE estado = 'TERMINADA' AND fecha_fin < :antes`, { antes }, QueryTypes.DELETE);
  await q(`DELETE FROM dbo.TCL_CargaSuelta WHERE estado = 'DESPACHADO' AND fechaModificacion < :antes`, { antes }, QueryTypes.DELETE);
}

module.exports = {
  MIGRACION_013, operaciones, avance, equipos, folios, vehiculos, historico, idsOperacion,
  guardarOperacion, guardarAvance, guardarEquipo, guardarFolio, guardarVehiculos, hayDatosReales, purgar,
};
