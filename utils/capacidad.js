/*
    Author: German Valencia
    Pattern: PORTTOS Núcleo puro (AD-16) - Tablero de Capacidad de nodos operativos (TLC_CAPACIDAD_001)
    Description: Sin base de datos ni red.
      Une dos catálogos sin duplicarlos: TCL_CapacidadNodos (terminales, patios, depots, patios de vehículos y
      break-bulk) y TCL_MaestroBodegas (las bodegas, como nodos 'BOD-<id_bodega>').
      La ocupación sale de la foto más reciente de TCL_OcupacionNodos (de las últimas 6 h); para las bodegas, si no
      hay foto, del inventario del maestro. Tráfico de entrada/salida y espera solo de las fotos.
      Entradas: { nodos, bodegas, ocupaciones (fotos de las últimas 24 h), puerto }
      Salida: { kpis, saturacion, trafico, nodos, tendencia, simulado }
*/
const C = require('./tablero-comun');

const CATEGORIAS = Object.freeze({
  TERMINAL: 'Terminales',
  PATIO_CONTENEDOR: 'Patios de contenedores',
  DEPOT_VACIOS: 'Depots de vacíos',
  BODEGA_GRANEL: 'Bodegas de granel',
  BODEGA_CONTENEDOR: 'Bodegas de contenedor',
  BODEGA_SUELTA: 'Bodegas de carga suelta',
  BODEGA_MULTI: 'Bodegas multipropósito',
  PATIO_PDI: 'Patios de vehículos',
  PATIO_BREAKBULK: 'Patios break-bulk',
});
const VIGENCIA_FOTO_MS = 6 * 3600000;

/** Categoría de una bodega según su tipo de carga principal. */
function categoriaBodega(tipoCarga) {
  const t = String(tipoCarga || '').toUpperCase();
  if (/GRANEL|GRANO|MAIZ|MAÍZ|TRIGO|SOYA|CLINKER|FERTILIZ/.test(t)) return 'BODEGA_GRANEL';
  if (/CONTENEDOR|LCL|FCL|REEFER/.test(t)) return 'BODEGA_CONTENEDOR';
  if (/SUELTA|BREAK|GENERAL|ACERO|PAPEL/.test(t)) return 'BODEGA_SUELTA';
  return 'BODEGA_MULTI';
}

const textoCapacidad = (capacidad, unidad, descripcion) => {
  if (descripcion) return descripcion;
  const n = Math.round(capacidad).toLocaleString('es-CO');
  return { TEU: `${n} TEU`, TON: `${n} t`, UNIDADES: `${n} vehículos`, M2: `${n} m²` }[unidad] || n;
};

const estadoDe = (p) => (p === null ? 'SIN DATO' : p >= C.UMBRALES_SATURACION.critico ? 'CRÍTICO' : p >= C.UMBRALES_SATURACION.atencion ? 'ATENCIÓN' : 'NORMAL');

function armarCapacidad({ nodos = [], bodegas = [], ocupaciones = [], puerto = null }, ahora = new Date()) {
  const ahoraMs = ahora.getTime();
  const ultima = new Map();
  for (const o of ocupaciones) {
    const previa = ultima.get(o.id_nodo);
    if (!previa || Date.parse(o.fecha) > Date.parse(previa.fecha)) ultima.set(o.id_nodo, o);
  }
  const vigente = (id) => {
    const o = ultima.get(id);
    return o && ahoraMs - Date.parse(o.fecha) <= VIGENCIA_FOTO_MS ? o : null;
  };

  const catalogo = [
    ...nodos.filter((n) => n.activo !== false && n.activo !== 0).map((n) => ({
      id: n.id_nodo, nombre: n.nombre, categoria: n.categoria, operador: n.operador, unidad: n.unidad_capacidad,
      capacidad: C.num(n.capacidad) || 0, descripcion: n.descripcion_capacidad,
      operaciones: String(n.operaciones || '').split('|').map((s) => s.trim()).filter(Boolean), ocupacionMaestro: null,
    })),
    ...bodegas.filter((b) => b.activo !== false && b.activo !== 0).map((b) => ({
      id: `BOD-${b.id_bodega}`, nombre: b.nombre_bodega, categoria: categoriaBodega(b.tipo_carga_principal),
      operador: null, unidad: 'TON', capacidad: C.num(b.capacidad_maxima_ton) || 0, descripcion: null,
      operaciones: [b.tipo_almacenamiento, b.tipo_carga_principal].filter(Boolean),
      ocupacionMaestro: C.pct(C.num(b.inventario_actual_ton) || 0, C.num(b.capacidad_maxima_ton) || 0),
    })),
  ];

  const filas = catalogo.map((n) => {
    const foto = vigente(n.id);
    const porcentaje = foto ? C.num(foto.ocupacion_pct) : n.ocupacionMaestro;
    return {
      id: n.id, nombre: n.nombre, categoria: n.categoria, categoriaNombre: CATEGORIAS[n.categoria] || n.categoria,
      operador: n.operador, unidad: n.unidad, capacidad: n.capacidad, capacidadTexto: textoCapacidad(n.capacidad, n.unidad, n.descripcion),
      operaciones: n.operaciones, ocupacionPct: porcentaje, semaforo: C.semaforo(porcentaje), estado: estadoDe(porcentaje),
      ingresosH: foto ? C.num(foto.ingresos_h) : null, salidasH: foto ? C.num(foto.salidas_h) : null,
      esperaMin: foto ? C.num(foto.espera_min) : null, fechaDato: foto ? foto.fecha : null, simulado: !!foto?.simulado,
    };
  }).sort((a, b) => (b.ocupacionPct ?? -1) - (a.ocupacionPct ?? -1));

  const simulado = filas.some((f) => f.simulado);
  const conDato = filas.filter((f) => f.ocupacionPct !== null);
  const criticos = filas.filter((f) => f.estado === 'CRÍTICO');
  const porCategoria = Object.keys(CATEGORIAS).map((k) => ({ k, filas: filas.filter((f) => f.categoria === k) })).filter((x) => x.filas.length);
  const resumenCategorias = porCategoria.map(({ k, filas: fs }) => `${fs.length} ${CATEGORIAS[k].toLowerCase()}`).slice(0, 4).join(' · ');

  const kpis = {
    PTT_CAP_KPI_NODOS: C.kpi({ titulo: 'NODOS MONITOREADOS', valor: filas.length, colorBorde: 'borde-blue', icono: 'feather icon-grid', simulado, subtitulo: resumenCategorias || 'Sin nodos en el catálogo' }),
    PTT_CAP_KPI_TEU: C.kpi({ titulo: 'CAPACIDAD CONTENEDOR', valor: Math.round(C.suma(filas.filter((f) => f.unidad === 'TEU'), (f) => f.capacidad)), unidad: 'TEU', colorBorde: 'borde-cyan', icono: 'feather icon-box', simulado, subtitulo: 'Terminales, patios y depots' }),
    PTT_CAP_KPI_TON: C.kpi({ titulo: 'CAPACIDAD GRANEL / SUELTA', valor: Math.round(C.suma(filas.filter((f) => f.unidad === 'TON'), (f) => f.capacidad)), unidad: 't', colorBorde: 'borde-green', icono: 'feather icon-database', simulado, subtitulo: `${filas.filter((f) => f.categoria.startsWith('BODEGA')).length} bodegas` }),
    PTT_CAP_KPI_CRITICOS: C.kpi({ titulo: 'NODOS CRÍTICOS', valor: criticos.length, colorBorde: criticos.length ? 'borde-rojo' : 'borde-green', icono: 'feather icon-alert-triangle', simulado, subtitulo: criticos.length ? criticos.slice(0, 3).map((f) => f.nombre).join(' · ') : `Ninguno ≥ ${C.UMBRALES_SATURACION.critico} %` }),
  };  // Vista ampliada de los KPI (2026-10-24)
  const umbralesCap = { amarillo: C.UMBRALES_SATURACION.atencion, rojo: C.UMBRALES_SATURACION.critico, sentido: 'mayor' };
  Object.assign(kpis.PTT_CAP_KPI_NODOS, {
    desglose: porCategoria.map(({ k, filas: fs }) => ({ etiqueta: CATEGORIAS[k], valor: fs.length, unidad: 'nodos' })),
    definicion: `Nodos activos del catálogo de capacidad y bodegas del puerto; ${conDato.length} de ${filas.length} con dato de ocupación vigente.`,
  });
  Object.assign(kpis.PTT_CAP_KPI_TEU, {
    desglose: filas.filter((f) => f.unidad === 'TEU').sort((a, b) => b.capacidad - a.capacidad).map((f) => ({ etiqueta: f.nombre, valor: f.capacidad, unidad: 'TEU' })),
    definicion: 'Suma de la capacidad declarada (TEU) de terminales, patios y depots del catálogo.',
  });
  Object.assign(kpis.PTT_CAP_KPI_TON, {
    desglose: filas.filter((f) => f.unidad === 'TON').sort((a, b) => b.capacidad - a.capacidad).map((f) => ({ etiqueta: f.nombre, valor: f.capacidad, unidad: 't' })),
    definicion: 'Suma de la capacidad en toneladas de bodegas y patios de granel y carga suelta.',
  });
  Object.assign(kpis.PTT_CAP_KPI_CRITICOS, {
    desglose: criticos.map((f) => ({ etiqueta: f.nombre, valor: f.ocupacionPct, unidad: '%', semaforo: 'rojo' })),
    umbrales: umbralesCap,
    definicion: `Nodos con ocupación ≥ ${C.UMBRALES_SATURACION.critico} % en su último dato vigente (${filas.length - conDato.length} nodos sin dato no se evalúan).`,
  });


  const promedio = (fs) => {
    const v = fs.map((f) => f.ocupacionPct).filter((x) => x !== null);
    return v.length ? C.redondear(v.reduce((a, b) => a + b, 0) / v.length, 1) : 0;
  };

  // Tendencia: promedio por categoría y hora (fotos de las últimas 24 h)
  const categoriaDe = new Map(filas.map((f) => [f.id, f.categoria]));
  const serieBase = C.serieHoraria([], ahoraMs, 24);
  const acumulado = new Map();   // categoria → [{suma, n}] por hora
  for (const o of ocupaciones) {
    const cat = categoriaDe.get(o.id_nodo);
    const i = serieBase.horasMs.indexOf(C.inicioHora(Date.parse(o.fecha)));
    if (!cat || i < 0) continue;
    if (!acumulado.has(cat)) acumulado.set(cat, serieBase.horasMs.map(() => ({ suma: 0, n: 0 })));
    const celda = acumulado.get(cat)[i];
    celda.suma += C.num(o.ocupacion_pct) || 0; celda.n++;
  }

  return {
    puerto,
    generadoEn: ahora.toISOString(),
    simulado,
    kpis,
    saturacion: { labels: porCategoria.map((x) => CATEGORIAS[x.k]), valores: porCategoria.map((x) => promedio(x.filas)) },
    trafico: {
      labels: porCategoria.map((x) => CATEGORIAS[x.k]),
      ingresos: porCategoria.map((x) => C.suma(x.filas, (f) => f.ingresosH)),
      salidas: porCategoria.map((x) => C.suma(x.filas, (f) => f.salidasH)),
    },
    nodos: filas,
    categorias: porCategoria.map((x) => ({ codigo: x.k, nombre: CATEGORIAS[x.k], nodos: x.filas.length })),
    tendencia: {
      labels: serieBase.labels,
      series: [...acumulado.entries()].map(([cat, celdas]) => ({
        categoria: CATEGORIAS[cat] || cat, valores: celdas.map((c) => (c.n ? C.redondear(c.suma / c.n, 1) : null)),
      })),
    },
    cobertura: { conDato: conDato.length, total: filas.length },
  };
}

/**
 * Serie de un nodo (vista ampliada, Fase 3): última foto de cada hora (ocupación, entradas, salidas, espera).
 * Las horas sin foto quedan en null (no se inventa 0).
 */
function serieNodo({ fotos = [], horas = 24 }, ahora = new Date()) {
  const fin = C.inicioHora(ahora.getTime());
  const horasMs = Array.from({ length: horas }, (_, i) => fin - (horas - 1 - i) * 3600000);
  const ultima = new Map();
  for (const f of fotos) {
    const h = C.inicioHora(Date.parse(f.fecha));
    if (!ultima.has(h) || Date.parse(f.fecha) > Date.parse(ultima.get(h).fecha)) ultima.set(h, f);
  }
  const campo = (k) => horasMs.map((h) => (ultima.has(h) ? C.num(ultima.get(h)[k]) : null));
  return {
    labels: horasMs.map(horas > 48 ? (h) => `${new Date(h - 5 * 3600000).toISOString().slice(8, 10)}/${C.etiquetaHora(h)}` : C.etiquetaHora),
    ocupacionPct: campo('ocupacion_pct'), ingresosH: campo('ingresos_h'), salidasH: campo('salidas_h'), esperaMin: campo('espera_min'),
    simulado: fotos.some((f) => f.simulado === 1 || f.simulado === true), conDato: ultima.size, horas,
  };
}

module.exports = { serieNodo, CATEGORIAS, categoriaBodega, armarCapacidad };
