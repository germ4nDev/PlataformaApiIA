/*
    Author: German Valencia
    Pattern: PORTTOS Núcleo puro (AD-16) - Bodegas y silos (TLC_BODEGAS_001)
    Description: Sin base de datos ni red. Tablero de la pestaña Bodegas (Fase 1 de la vista ampliada, 2026-10-23):
      - Movimientos con ventana real: KPI de 24 h y gráfica de flujo de 7 días sobre fechaCreacion (antes los
        últimos 50 movimientos de cualquier fecha, así que el KPI "24 h" podía quedarse corto).
      - Estadía calculada desde la fecha de ingreso del lote (antes dias_almacenaje fijo al registrar: no avanzaba).
      - Bodegas sin capacidad: ocupación null ("sin dato"), no 0 %.
      - Origen del dato con periodo y avisos (bodegas sin capacidad, movimientos recortados).
*/
const C = require('./tablero-comun');
const { origen } = require('./origen-dato');
const { serieNodo } = require('./capacidad');

const UMBRAL_CRITICO = 90;
const DIAS_FLUJO = 7;
const DIA_MS = 86400000;
const op = (m) => String(m.tipo_operacion || '').toUpperCase();
const esIngreso = (m) => /INGRESO|DESCARG|BUQUE/.test(op(m));
const esTraslado = (m) => op(m).includes('TRASLADO');
const ms = (m) => Date.parse(m.fechaCreacion);

/** Días de almacenaje del lote: desde su ingreso, mientras siga almacenado; si no hay fecha, el valor guardado. */
function estadia(m, ahoraMs) {
  const t = ms(m);
  const almacenado = !/DESPACH|ENTREG|SALID|CERRAD/i.test(String(m.estado || ''));
  if (almacenado && esIngreso(m) && Number.isFinite(t)) return Math.max(0, Math.floor((ahoraMs - t) / DIA_MS));
  return C.num(m.dias_almacenaje);
}

function kpis(bodegas, movimientos, ahoraMs) {
  const conCapacidad = bodegas.filter((b) => C.num(b.capacidad_maxima_ton) > 0);
  const totalCapacidad = C.suma(conCapacidad, (b) => b.capacidad_maxima_ton);
  const totalInventario = C.suma(bodegas, (b) => b.inventario_actual_ton);
  const invConCapacidad = C.suma(conCapacidad, (b) => b.inventario_actual_ton);
  const pct = totalCapacidad > 0 ? Math.round((invConCapacidad / totalCapacidad) * 100) : null;
  const criticas = bodegas.filter((b) => C.num(b.ocupacion_pct) >= UMBRAL_CRITICO || String(b.estado_operativo || '').toUpperCase().includes('CRÍTIC'));
  const m24 = movimientos.filter((m) => ms(m) >= ahoraMs - DIA_MS && !esTraslado(m));
  const ton24 = C.redondear(C.suma(m24, (m) => m.toneladas), 1);
  const ranking = [...bodegas].filter((b) => C.num(b.ocupacion_pct) !== null).sort((a, b) => b.ocupacion_pct - a.ocupacion_pct);
  return {
    ocupacionGeneral: {
      titulo: 'OCUPACIÓN DE BODEGAS', valor: pct === null ? '—' : `${pct}%`,
      subtitulo: `${bodegas.length} bodegas y silos activos${bodegas.length - conCapacidad.length ? ` · ${bodegas.length - conCapacidad.length} sin capacidad` : ''}`,
      colorBorde: pct !== null && pct >= UMBRAL_CRITICO ? 'borde-rojo' : 'borde-cyan',
      umbrales: { amarillo: 75, rojo: UMBRAL_CRITICO, sentido: 'mayor' },
      desglose: ranking.map((b) => ({ etiqueta: b.codigo_bodega || b.nombre_bodega, valor: C.num(b.ocupacion_pct), unidad: '%', semaforo: C.num(b.ocupacion_pct) >= UMBRAL_CRITICO ? 'rojo' : C.num(b.ocupacion_pct) >= 75 ? 'amarillo' : 'verde' })),
      definicion: 'Inventario actual sobre capacidad máxima, sumando solo las bodegas con capacidad registrada.',
      formula: 'Σ inventario_actual_ton / Σ capacidad_maxima_ton × 100',
    },
    inventarioTotal: {
      titulo: 'INVENTARIO ALMACENADO', valor: `${totalInventario.toLocaleString('es-CO')} Ton`,
      subtitulo: `Capacidad: ${totalCapacidad.toLocaleString('es-CO')} Ton`, colorBorde: 'borde-green',
      desglose: [...bodegas].sort((a, b) => (b.inventario_actual_ton || 0) - (a.inventario_actual_ton || 0))
        .map((b) => ({ etiqueta: b.codigo_bodega || b.nombre_bodega, valor: C.num(b.inventario_actual_ton) || 0, unidad: 't' })),
    },
    tasaDespacho: {
      titulo: 'FLUJO OPERATIVO (24H)', valor: `${ton24.toLocaleString('es-CO')} Ton`,
      subtitulo: `${m24.length} lotes en recibo / despacho (24 h)`, colorBorde: 'borde-amarillo',
      desglose: [
        { etiqueta: 'Ingresos de buque', valor: C.redondear(C.suma(m24.filter(esIngreso), (m) => m.toneladas), 1), unidad: 't' },
        { etiqueta: 'Despachos', valor: C.redondear(C.suma(m24.filter((m) => !esIngreso(m)), (m) => m.toneladas), 1), unidad: 't' },
      ],
      definicion: 'Toneladas de ingresos y despachos registrados en las últimas 24 h (los traslados internos no cuentan).',
    },
    alertasBodega: {
      titulo: 'BODEGAS EN ALERTA', valor: String(criticas.length),
      subtitulo: criticas.length ? `${criticas.length} zonas con saturación ≥ ${UMBRAL_CRITICO}%` : 'Almacenamiento en rango normal',
      colorBorde: criticas.length ? 'borde-rojo' : 'borde-purple',
      desglose: criticas.map((b) => ({ etiqueta: b.codigo_bodega || b.nombre_bodega, valor: C.num(b.ocupacion_pct), unidad: '%', semaforo: 'rojo' })),
      definicion: `Bodegas con ocupación ≥ ${UMBRAL_CRITICO} % o marcadas en estado crítico.`,
    },
  };
}

function flujo(bodegas, movimientos, ahoraMs) {
  const desde = ahoraMs - DIAS_FLUJO * DIA_MS;
  const mapa = new Map(bodegas.map((b) => [b.codigo_bodega, { etiqueta: b.codigo_bodega, entradas: 0, salidas: 0 }]));
  for (const m of movimientos.filter((x) => ms(x) >= desde && !esTraslado(x))) {
    const b = bodegas.find((x) => x.id_bodega === m.id_bodega || x.nombre_bodega === m.nombre_bodega);
    const clave = b ? b.codigo_bodega : m.nombre_bodega || 'SIN BODEGA';
    if (!mapa.has(clave)) mapa.set(clave, { etiqueta: clave, entradas: 0, salidas: 0 });
    const item = mapa.get(clave);
    if (esIngreso(m)) item.entradas = C.redondear(item.entradas + (C.num(m.toneladas) || 0), 1);
    else item.salidas = C.redondear(item.salidas + (C.num(m.toneladas) || 0), 1);
  }
  const lista = [...mapa.values()];
  return {
    titulo: '📊 Flujo de Recibo vs. Despacho (Ton)',
    subtitulo: `Ingreso desde buque frente a despacho por bodega · últimos ${DIAS_FLUJO} días`,
    categorias: lista.map((f) => f.etiqueta), entradas: lista.map((f) => f.entradas), salidas: lista.map((f) => f.salidas),
  };
}

/**
 * @param {{ bodegas:object[], movimientos:object[], resumenCarga:object[], puerto:string }} datos
 */
function armarBodegas({ bodegas = [], movimientos = [], resumenCarga = [], puerto = null }, ahora = new Date()) {
  const ahoraMs = ahora.getTime();
  const movs = (movimientos || []).map((m) => ({ ...m, dias_almacenaje: estadia(m, ahoraMs), dias_almacenaje_registrado: C.num(m.dias_almacenaje) }));
  const sinCapacidad = bodegas.filter((b) => !(C.num(b.capacidad_maxima_ton) > 0)).length;
  const totalRango = C.num(movimientos[0]?.total_rango) ?? movimientos.length;
  const o = origen({
    fuente: 'TCL_MaestroBodegas + TCL_MovimientosBodega',
    periodo: `Inventario actual · movimientos de los últimos ${DIAS_FLUJO} días`,
    nota: [
      sinCapacidad ? `${sinCapacidad} bodegas sin capacidad registrada` : null,
      totalRango > movimientos.length ? `se muestran los ${movimientos.length} movimientos más recientes de ${totalRango}` : null,
    ],
  }, ahora);
  const k = kpis(bodegas, movs, ahoraMs);
  Object.values(k).forEach((x) => (x.origen = o));

  return {
    puerto,
    kpis: k,
    saturacionBodegas: bodegas,
    flujoEntradasSalidas: { ...flujo(bodegas, movs, ahoraMs), origen: o },
    distribucionPorCarga: {
      titulo: '🌾 Inventario por Tipo de Carga',
      subtitulo: 'Participación volumétrica en bodegas y silos (Ton)',
      labels: resumenCarga.map((r) => r.tipo_carga),
      valores: resumenCarga.map((r) => C.num(r.total_toneladas) || 0),
      capacidades: resumenCarga.map((r) => C.num(r.capacidad_toneladas)),
      bodegasPorTipo: resumenCarga.map((r) => C.num(r.cantidad_bodegas) || 0),
      origen: o,
    },
    movimientosBodega: movs,
    origen: o,
  };
}

/**
 * Vista ampliada (Fase 3): serie de ocupación de cada bodega desde las fotos de TCL_OcupacionNodos (id_nodo
 * 'BOD-<id_bodega>'). Las horas sin foto quedan en null.
 */
function serieOcupacionBodegas({ bodegas = [], fotos = [], horas = 24 }, ahora = new Date()) {
  const lista = bodegas.map((b) => {
    const s = serieNodo({ fotos: fotos.filter((f) => f.id_nodo === `BOD-${b.id_bodega}`), horas }, ahora);
    return { idBodega: b.id_bodega, codigo: b.codigo_bodega, nombre: b.nombre_bodega, ocupacionPct: s.ocupacionPct, conDato: s.conDato, simulado: s.simulado, labels: s.labels };
  });
  return {
    labels: lista[0]?.labels || serieNodo({ fotos: [], horas }, ahora).labels,
    bodegas: lista.map(({ labels, ...b }) => b),
    umbrales: { atencion: 75, critico: UMBRAL_CRITICO },
    origen: origen({
      fuente: 'TCL_OcupacionNodos (fotos de ocupación)', simulado: lista.some((b) => b.simulado),
      periodo: `Últimas ${horas} h`, nota: lista.every((b) => !b.conDato) ? 'Sin fotos de ocupación en el periodo' : null,
    }, ahora),
  };
}

/** Vista ampliada (Fase 3): movimientos del rango con la estadía calculada. */
function movimientosConEstadia(movimientos = [], dias, ahora = new Date()) {
  const total = C.num(movimientos[0]?.total_rango) ?? movimientos.length;
  return {
    movimientos: movimientos.map((m) => ({ ...m, dias_almacenaje: estadia(m, ahora.getTime()), dias_almacenaje_registrado: C.num(m.dias_almacenaje) })),
    total,
    origen: origen({
      fuente: 'TCL_MovimientosBodega', periodo: `Últimos ${dias} días`,
      nota: total > movimientos.length ? `se muestran los ${movimientos.length} más recientes de ${total}` : null,
    }, ahora),
  };
}

module.exports = { UMBRAL_CRITICO, DIAS_FLUJO, estadia, armarBodegas, serieOcupacionBodegas, movimientosConEstadia };
