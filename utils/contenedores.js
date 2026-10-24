/*
    Author: German Valencia
    Pattern: PORTTOS Núcleo puro (AD-16) - Contenedores (TLC_CONTENEDORES_001)
    Description: Sin base de datos ni red. Tablero de la pestaña Contenedores (Fase 1 de la vista ampliada, 2026-10-23).
      Antes: patios, retiros y free time con valores fijos (AD-04), capacidad con Math.random(), vacíos × 15 y
      subtítulos falsos ("retiro próx 24h", "98% conexión OK"). Ahora:
      - Inventario real en patio (TCL_InventarioContenedores): cargados, vacíos, reefer, free time (vencidos y por
        vencer) y retiros por día según fecha_limite_freetime, todo por contenedor y TEU.
      - Patios: nodos PATIO_CONTENEDOR y DEPOT_VACIOS de TCL_CapacidadNodos con su última foto de ocupación (la
        misma fuente de la pestaña Capacidad); si la foto es simulada se dice.
      - Movimientos (TCL_MovimientosContenedor) para la tabla y como respaldo de los KPI cuando no hay inventario.
      - Sin fuente → vacío y explicado en `origen`, nunca un número inventado.
*/
const C = require('./tablero-comun');
const { origen } = require('./origen-dato');

const ESTADOS_FUERA = ['RETIRADO', 'DESPACHADO', 'EMBARCADO', 'SALIDA', 'ENTREGADO', 'BAJA'];
const DIA_MS = 86400000;
const texto = (v) => String(v ?? '').trim();
const minus = (v) => texto(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** TEU por código ISO 6346: 2xxx = 20' (1 TEU), 4xxx/Lxxx/9xxx = 40'/45' (2 TEU). */
const teu = (iso) => (/^[2]/.test(texto(iso).toUpperCase()) ? 1 : /^[4L9M]/.test(texto(iso).toUpperCase()) ? 2 : 1);
const esVacio = (c) => /^VAC|^EMPTY|^E$/.test(texto(c.estado_carga).toUpperCase());
const activo = (c) => !ESTADOS_FUERA.includes(texto(c.estado_operativo).toUpperCase());
const esReefer = (c) => c.es_reefer === true || c.es_reefer === 1;

/** Días (de Colombia) entre hoy y la fecha límite del free time; null si no tiene. */
function diasFreeTime(c, ahoraMs) {
  const ms = Date.parse(c.fecha_limite_freetime);
  if (!Number.isFinite(ms)) return null;
  return Math.floor((C.inicioDiaColombia(ms) - C.inicioDiaColombia(ahoraMs)) / DIA_MS);
}

function kpisInventario(inv, ahoraMs) {
  const llenos = inv.filter((c) => !esVacio(c));
  const vacios = inv.filter(esVacio);
  const reefer = inv.filter(esReefer);
  const conFt = llenos.filter((c) => Number.isFinite(Date.parse(c.fecha_limite_freetime)));
  const vencidos = conFt.filter((c) => Date.parse(c.fecha_limite_freetime) < ahoraMs);
  const vencen24 = conFt.filter((c) => { const ms = Date.parse(c.fecha_limite_freetime); return ms >= ahoraMs && ms < ahoraMs + DIA_MS; });
  const teus = (l) => C.suma(l, (c) => teu(c.codigo_iso));
  // Vista ampliada: desglose por naviera (y los vencidos con sus días de atraso)
  const porNaviera = (l, unidad = 'contenedores') => C.agrupar(l, (c) => texto(c.naviera) || 'SIN NAVIERA', () => 1).map((g) => ({ etiqueta: g.clave, valor: g.valor, unidad }));
  const atraso = (c) => Math.max(0, Math.floor((ahoraMs - Date.parse(c.fecha_limite_freetime)) / DIA_MS));
  return {
    cargadosPendientes: {
      valor: llenos.length, subtitulo: `${teus(llenos)} TEU llenos en patio · ${vencen24.length} vencen free time en 24 h`, color: '#38bdf8',
      desglose: porNaviera(llenos), definicion: 'Contenedores llenos en patio (inventario activo), pendientes de retiro.',
    },
    vaciosDevolver: {
      valor: vacios.length, subtitulo: `${teus(vacios)} TEU vacíos en patio`, color: '#a855f7',
      desglose: porNaviera(vacios), definicion: 'Contenedores vacíos en patio por devolver a su naviera.',
    },
    reeferActivos: {
      valor: reefer.length, color: '#22c55e',
      subtitulo: `${reefer.filter((c) => C.num(c.temp_requerida_celsius) !== null).length} con temperatura de consigna registrada`,
      desglose: porNaviera(reefer), definicion: 'Contenedores refrigerados (es_reefer) en patio.',
    },
    freeTimeVencido: {
      valor: vencidos.length, color: '#ef4444',
      subtitulo: `${vencen24.length} vencen en 24 h${llenos.length - conFt.length ? ` · ${llenos.length - conFt.length} sin fecha` : ''}`,
      desglose: [...vencidos].sort((a, b) => atraso(b) - atraso(a)).slice(0, 50)
        .map((c) => ({ etiqueta: `${c.sigla_numero} · ${texto(c.naviera) || 'sin naviera'}`, valor: atraso(c), unidad: 'días', semaforo: 'rojo' })),
      definicion: 'Contenedores llenos con la fecha límite de free time ya vencida (desglose: días de atraso).',
    },
  };
}

/** Respaldo cuando no hay inventario: conteos de movimientos (sin multiplicar ni inventar). */
function kpisMovimientos(movs) {
  const op = (m) => minus(m.operacion);
  const vacio = (m) => op(m).includes('vacio');
  const n = (l) => ({ valor: l.length });
  return {
    cargadosPendientes: { ...n(movs.filter((m) => op(m).includes('retiro') && !vacio(m))), subtitulo: 'movimientos de retiro registrados (sin inventario en patio)', color: '#38bdf8' },
    vaciosDevolver: { ...n(movs.filter(vacio)), subtitulo: 'movimientos de vacíos registrados (sin inventario en patio)', color: '#a855f7' },
    reeferActivos: { ...n(movs.filter((m) => /RH|RF|REEF/i.test(texto(m.tipo)))), subtitulo: 'movimientos reefer registrados', color: '#22c55e' },
    freeTimeVencido: { ...n(movs.filter((m) => /DEMORA|VENCID/i.test(texto(m.estado)))), subtitulo: 'movimientos marcados en demora o vencidos', color: '#ef4444' },
  };
}

/** Contenedores llenos por día de vencimiento del free time (hoy … +7 d); los ya vencidos van en su serie. */
function retirosPorDia(inv, ahoraMs) {
  const categorias = ['Hoy', '+1d', '+2d', '+3d', '+4d', '+5d', '+6d', '+7d'];
  const llenos = inv.filter((c) => !esVacio(c));
  const pendiente = (c) => Date.parse(c.fecha_limite_freetime) >= ahoraMs;
  const vence = categorias.map((_, d) => llenos.filter((c) => pendiente(c) && diasFreeTime(c, ahoraMs) === d).length);
  const vencidos = llenos.filter((c) => Date.parse(c.fecha_limite_freetime) < ahoraMs).length;
  return {
    categorias,
    series: [
      { name: 'Vence free time', data: vence },
      { name: 'Ya vencidos', data: categorias.map((_, i) => (i === 0 ? vencidos : 0)) },
    ],
  };
}

function freeTimeDistribucion(inv, ahoraMs) {
  const llenos = inv.filter((c) => !esVacio(c));
  const cuenta = { en: 0, riesgo: 0, demora: 0, sin: 0 };
  for (const c of llenos) {
    const ms = Date.parse(c.fecha_limite_freetime);
    if (!Number.isFinite(ms)) cuenta.sin++;
    else if (ms < ahoraMs) cuenta.demora++;
    else if (ms < ahoraMs + DIA_MS) cuenta.riesgo++;
    else cuenta.en++;
  }
  const labels = ['En free time', 'Riesgo demora (<24h)', 'En demora'];
  const series = [cuenta.en, cuenta.riesgo, cuenta.demora];
  if (cuenta.sin) { labels.push('Sin fecha de free time'); series.push(cuenta.sin); }
  return { labels, series, unidad: 'contenedores' };
}

function vaciosPorNaviera(inv, movs) {
  const conteo = new Map();
  if (inv.length) {
    for (const c of inv.filter(esVacio)) conteo.set(texto(c.naviera) || 'SIN NAVIERA', (conteo.get(texto(c.naviera) || 'SIN NAVIERA') || 0) + 1);
  } else {
    for (const m of movs.filter((x) => minus(x.operacion).includes('vacio'))) conteo.set(texto(m.naviera) || 'SIN NAVIERA', (conteo.get(texto(m.naviera) || 'SIN NAVIERA') || 0) + 1);
  }
  const orden = [...conteo.entries()].sort((a, b) => b[1] - a[1]);
  return { categorias: orden.map(([k]) => k), series: [{ name: inv.length ? 'Vacíos en patio' : 'Movimientos de vacíos', data: orden.map(([, v]) => v) }] };
}

/** Patios con capacidad (TCL_CapacidadNodos) y su última foto de ocupación de las últimas 6 h. */
function patios(nodos, fotos, ahoraMs) {
  const vigente = ahoraMs - 6 * 3600000;
  const ultima = new Map();
  for (const f of fotos || []) {
    const ms = Date.parse(f.fecha);
    if (ms < vigente) continue;
    if (!ultima.has(f.id_nodo) || ms > Date.parse(ultima.get(f.id_nodo).fecha)) ultima.set(f.id_nodo, f);
  }
  return (nodos || []).filter((n) => ['PATIO_CONTENEDOR', 'DEPOT_VACIOS'].includes(n.categoria)).map((n) => {
    const f = ultima.get(n.id_nodo);
    const pctOcupacion = f ? C.num(f.ocupacion_pct) : null;
    const s = C.semaforo(pctOcupacion);
    return {
      nombre: n.nombre, id: n.id_nodo, categoria: n.categoria, capacidadTeus: C.num(n.capacidad), unidad: n.unidad_capacidad,
      porcentaje: pctOcupacion, estado: { rojo: 'CRÍTICO', amarillo: 'ALTO', verde: 'OK', gris: 'SIN DATO' }[s],
      fechaDato: f ? f.fecha : null, simulado: !!(f && (f.simulado === 1 || f.simulado === true)), fuenteCapacidad: n.fuente || null,
    };
  });
}

/**
 * @param {{ movimientos:object[], inventario:object[], nodos:object[], fotos:object[], puerto:string }} datos
 */
function armarContenedores({ movimientos = [], inventario = [], nodos = [], fotos = [], puerto = null }, ahora = new Date()) {
  const ahoraMs = ahora.getTime();
  const inv = (inventario || []).filter(activo);
  const movs = movimientos || [];
  const hayInv = inv.length > 0;
  const listaPatios = patios(nodos, fotos, ahoraMs);

  const oInv = origen({
    fuente: hayInv ? 'TCL_InventarioContenedores' : 'TCL_MovimientosContenedor',
    periodo: hayInv ? 'Inventario actual en patio' : 'Todos los movimientos registrados',
    nota: hayInv ? null : 'Sin inventario de contenedores en patio para el puerto: los KPI cuentan movimientos',
  }, ahora);
  const oSinInv = origen({ fuente: 'TCL_InventarioContenedores', periodo: 'Inventario actual en patio', nota: hayInv ? null : 'Sin inventario en patio: no hay vencimientos que mostrar' }, ahora);
  const oPatios = origen({
    fuente: 'TCL_CapacidadNodos + TCL_OcupacionNodos',
    simulado: listaPatios.some((p) => p.simulado),
    periodo: 'Última foto de ocupación (≤ 6 h)',
    nota: [
      listaPatios.length ? null : 'El puerto no tiene patios de contenedores en el catálogo de capacidad',
      listaPatios.some((p) => p.porcentaje === null) ? `${listaPatios.filter((p) => p.porcentaje === null).length} patios sin foto vigente` : null,
      listaPatios.some((p) => p.fuenteCapacidad === 'CATALOGO_REFERENCIA') ? 'capacidades de referencia, a validar' : null,
    ],
  }, ahora);
  const sinPuerto = movs.filter((m) => m.id_puerto === null || m.id_puerto === undefined).length;
  const oMovs = origen({
    fuente: 'TCL_MovimientosContenedor',
    periodo: 'Todos los movimientos registrados',
    nota: sinPuerto ? `${sinPuerto} movimientos sin puerto asignado (se ven en todos los puertos)` : null,
  }, ahora);

  const kpis = hayInv ? kpisInventario(inv, ahoraMs) : kpisMovimientos(movs);
  Object.values(kpis).forEach((k) => (k.origen = oInv));

  return {
    puerto,
    kpis,
    retirosPriorizacion: { ...retirosPorDia(inv, ahoraMs), origen: oSinInv },
    vaciosNaviera: { ...vaciosPorNaviera(inv, movs), origen: oInv },
    saturacionPatios: listaPatios,
    freeTimeDistribucion: { ...freeTimeDistribucion(inv, ahoraMs), origen: oSinInv },
    movimientos: movs.map((m) => ({
      id_movimiento: m.id_movimiento ?? null, contenedor: m.contenedor, tipo: m.tipo, naviera: m.naviera, operacion: m.operacion,
      ruta: m.ruta, cliente: m.cliente, freeTime: m.free_time, estado: m.estado,
      fechaRegistro: m.fechaCreacion ?? null, sinPuerto: m.id_puerto === null || m.id_puerto === undefined,
    })),
    origenes: { inventario: oInv, patios: oPatios, movimientos: oMovs },
    origen: oInv,
  };
}

module.exports = { teu, diasFreeTime, kpisInventario, kpisMovimientos, retirosPorDia, freeTimeDistribucion, vaciosPorNaviera, patios, armarContenedores };
