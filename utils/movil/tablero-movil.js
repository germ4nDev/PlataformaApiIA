/*
    Author: German Valencia
    Pattern: PORTTOS Núcleo puro (AD-16) - Tablero móvil (app móvil, fase 2)
    Description: Convierte lo que ya devuelven los tableros de la web (y las fotos de KPI de la capa de IA) en widgets
      pensados para el teléfono. Sin base de datos ni red. Contrato de salida (lo pinta PorttosMovil):
        { puerto, pestana, modulo, generadoEn, simulado, widgets: Widget[] }
        Widget =
          { tipo: 'kpis',    id, titulo, items: KpiMovil[] }
          { tipo: 'lista',   id, titulo, subtitulo?, total, items: ItemLista[] }      (a lo sumo MAX_ITEMS)
          { tipo: 'grafica', id, titulo, subtitulo?, forma: 'barras'|'linea'|'dona', unidad?, labels[], series[{ nombre, valores[] }] }
        KpiMovil  = { id, titulo, valor (número o texto), unidad, estado, subtitulo?, simulado, serie?: number[] (≤ PUNTOS_SPARK) }
        ItemLista = { titulo, detalle?, valor?, unidad?, estado?, progreso? (0-100) }
        estado    = 'ok' | 'atencion' | 'critico' | 'neutro'
      Una receta por módulo; si un dato no viene, el widget se omite (no se inventan valores).
*/
const { CATALOGO_KPI } = require('../ia/catalogo-kpi');

const MAX_ITEMS = 8;
const PUNTOS_SPARK = 24;
const MAX_KPIS = 6;

/** Pestaña de la Torre de Control → módulo del tablero móvil. Una pestaña nueva sin receta → 'generico'. */
const MODULO_POR_PESTANA = Object.freeze({
  TLC_MARITIMO_001: 'maritimo',
  TLC_VIRTUAL_GATE_001: 'gate',
  TLC_BODEGAS_001: 'bodegas',
  TLC_CONTENEDORES_001: 'contenedores',
  TLC_GRANEL_001: 'granel',
  TLC_SUELTA_001: 'suelta',
  TLC_CAPACIDAD_001: 'capacidad',
  TLC_GNL_001: 'gnl',
  TLC_NOTICIAS_001: 'noticias',
  TLC_NOTICIAS: 'noticias',
  TLC_MAPA_001: 'mapa',
});

const moduloDePestana = (codigo) => MODULO_POR_PESTANA[String(codigo || '').toUpperCase()] || 'generico';

/** Fuentes que necesita cada módulo (las resuelve el servicio). */
const FUENTES_POR_MODULO = Object.freeze({
  maritimo: ['maritimo', 'llegadas'],
  gate: ['gate'],
  bodegas: ['bodegas'],
  contenedores: ['contenedores'],
  granel: ['granel'],
  suelta: ['suelta'],
  capacidad: ['capacidad'],
  gnl: ['gnl'],
  noticias: ['noticias'],
  mapa: ['viales', 'maritimo'],
  generico: [],
});

const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const redondear = (v, d = 1) => (v === null ? null : Math.round(v * 10 ** d) / 10 ** d);
const texto = (v) => (v === null || v === undefined ? '' : String(v).trim());

/** Color de borde de las tarjetas de la web (kpi-card-tcl) → estado. */
function estadoDesdeBorde(colorBorde) {
  const c = String(colorBorde || '').toLowerCase();
  if (/rojo|red|danger/.test(c)) return 'critico';
  if (/amarillo|naranja|orange|yellow|warning/.test(c)) return 'atencion';
  if (/green|verde|success/.test(c)) return 'ok';
  return 'neutro';
}

/** Estado por umbrales { atencion, critico, sentido: 'alto'|'bajo' } (los del sistema, nunca inventados). */
function estadoPorUmbral(valor, umbrales) {
  const v = num(valor);
  if (v === null || !umbrales) return 'neutro';
  const { atencion, critico, sentido = 'alto' } = umbrales;
  if (sentido === 'bajo') return v <= critico ? 'critico' : v <= atencion ? 'atencion' : 'ok';
  return v >= critico ? 'critico' : v >= atencion ? 'atencion' : 'ok';
}

/** Semáforo de los tableros (verde/amarillo/rojo/gris) o texto de estado (OK/ALTO/CRÍTICO) → estado. */
function estadoDesdeSemaforo(s) {
  const t = String(s || '').toUpperCase();
  if (['ROJO', 'CRÍTICO', 'CRITICO', 'CRITICA', 'CRÍTICA', 'ALTA'].includes(t)) return 'critico';
  if (['AMARILLO', 'ALTO', 'ATENCION', 'ATENCIÓN', 'MEDIA', 'NARANJA'].includes(t)) return 'atencion';
  if (['VERDE', 'OK', 'NORMAL', 'BAJA'].includes(t)) return 'ok';
  return 'neutro';
}

/** Reduce una serie a n puntos (promedio por tramo), sin nulos al inicio. */
function submuestrear(valores, n = PUNTOS_SPARK) {
  const v = (valores || []).map(num).filter((x) => x !== null);
  if (v.length <= n) return v;
  const tramo = v.length / n;
  return Array.from({ length: n }, (_, i) => {
    const parte = v.slice(Math.floor(i * tramo), Math.max(Math.floor((i + 1) * tramo), Math.floor(i * tramo) + 1));
    return redondear(parte.reduce((a, b) => a + b, 0) / parte.length, 2);
  });
}

/** Primera serie numérica de un objeto serie de kpi-card ({ '24 h': { labels, valores } }). */
function primeraSerie(serie) {
  if (!serie || typeof serie !== 'object') return null;
  if (Array.isArray(serie.valores)) return serie.valores;
  const primera = Object.values(serie).find((s) => s && Array.isArray(s.valores));
  return primera ? primera.valores : null;
}

/** Tarjeta KPI de un tablero de la web (contrato tablero-comun.kpi) → KpiMovil. */
function kpiDesdeTarjeta(id, t) {
  if (!t || typeof t !== 'object') return null;
  const serie = primeraSerie(t.serie);
  const umbralEstado = t.umbrales ? estadoPorUmbral(t.valor, t.umbrales) : null;
  const k = {
    id, titulo: texto(t.titulo) || id, valor: t.valor ?? null, unidad: texto(t.unidad),
    estado: umbralEstado && umbralEstado !== 'neutro' ? umbralEstado : estadoDesdeBorde(t.colorBorde),
    subtitulo: texto(t.subtitulo).replace(/\s*·\s*SIMULADO$/, '') || undefined, simulado: !!t.simulado,
  };
  if (serie && serie.length > 1) k.serie = submuestrear(serie);
  return k;
}

/** KPI del catálogo de la IA (foto + serie de 24 h) → KpiMovil. */
function kpiDesdeCatalogo(def, fila, serieFilas) {
  const valor = num(fila?.valor);
  const serie = submuestrear((serieFilas || []).map((f) => f.valor));
  const k = {
    id: def.codigo, titulo: def.titulo, valor, unidad: def.unidad,
    estado: estadoPorUmbral(valor, def.umbrales), simulado: !!fila?.simulado,
  };
  if (serie.length > 1) k.serie = serie;
  return k;
}

/** Gráfica desde las formas que usan los tableros: {labels, valores} · {labels, series[{nombre|categoria|name, valores|data}]}
 *  · {categorias, series[{name, data}]} · {labels, datasets[{label, data}]}. null si no hay datos. */
function graficaDe(obj, { id, titulo, subtitulo, forma = 'barras', unidad, max = 12 }) {
  if (!obj || typeof obj !== 'object') return null;
  const labels = (obj.labels || obj.categorias || []).map(texto);
  let series = [];
  if (Array.isArray(obj.valores)) series = [{ nombre: titulo, valores: obj.valores }];
  else if (Array.isArray(obj.series)) series = obj.series.map((s) => ({ nombre: texto(s.nombre || s.categoria || s.name || s.label), valores: s.valores || s.data || [] }));
  else if (Array.isArray(obj.datasets)) series = obj.datasets.map((s) => ({ nombre: texto(s.label || s.nombre), valores: s.data || s.valores || [] }));
  series = series
    .map((s) => ({ nombre: s.nombre, valores: s.valores.slice(0, forma === 'linea' ? undefined : max).map((v) => redondear(num(v), 2)) }))
    .filter((s) => s.valores.some((v) => v !== null && v !== 0));
  if (!labels.length || !series.length) return null;
  const etiquetas = forma === 'linea' ? labels : labels.slice(0, max);
  if (forma === 'linea' && etiquetas.length > PUNTOS_SPARK * 2) {
    const paso = Math.ceil(etiquetas.length / (PUNTOS_SPARK * 2));
    return {
      tipo: 'grafica', id, titulo, ...(subtitulo ? { subtitulo } : {}), forma, ...(unidad ? { unidad } : {}),
      labels: etiquetas.filter((_, i) => i % paso === 0), series: series.map((s) => ({ ...s, valores: s.valores.filter((_, i) => i % paso === 0) })),
    };
  }
  return { tipo: 'grafica', id, titulo, ...(subtitulo ? { subtitulo } : {}), forma, ...(unidad ? { unidad } : {}), labels: etiquetas, series };
}

/** Lista de a lo sumo MAX_ITEMS; null si viene vacía. */
function listaDe(filas, { id, titulo, subtitulo }, mapear) {
  const todas = (Array.isArray(filas) ? filas : []).map(mapear).filter((x) => x && x.titulo);
  if (!todas.length) return null;
  return { tipo: 'lista', id, titulo, ...(subtitulo ? { subtitulo } : {}), total: todas.length, items: todas.slice(0, MAX_ITEMS) };
}

/** Bloque de KPI desde las tarjetas de un tablero (en el orden del tablero; los primeros MAX_KPIS). */
function kpisDeTablero(kpis, id = 'kpis', titulo = 'Indicadores') {
  const items = Object.entries(kpis && typeof kpis === 'object' ? kpis : {}).map(([k, t]) => kpiDesdeTarjeta(k, t)).filter(Boolean).slice(0, MAX_KPIS);
  return items.length ? { tipo: 'kpis', id, titulo, items } : null;
}

/** Bloque de KPI del catálogo de la IA para un módulo (con su serie de 24 h). */
function kpisDeCatalogo(modulo, filas, series, codigos = null, titulo = 'Indicadores') {
  const defs = CATALOGO_KPI.filter((d) => d.modulo === modulo && (!codigos || codigos.includes(d.codigo)));
  const porCodigo = new Map((filas || []).map((f) => [f.codigoKpi, f]));
  const items = defs.map((d) => (porCodigo.has(d.codigo) ? kpiDesdeCatalogo(d, porCodigo.get(d.codigo), series?.get?.(d.codigo)) : null))
    .filter((k) => k && k.valor !== null)
    .sort((a, b) => (codigos ? codigos.indexOf(a.id) - codigos.indexOf(b.id) : 0))
    .slice(0, MAX_KPIS);
  return items.length ? { tipo: 'kpis', id: `kpis.${modulo}`, titulo, items } : null;
}

const minutosTexto = (m) => {
  const v = num(m);
  if (v === null) return '';
  if (v < 60) return `${Math.round(v)} min`;
  const h = Math.floor(v / 60);
  const r = Math.round(v % 60);
  return r ? `${h} h ${r} min` : `${h} h`;
};
const estadoPorPct = (p) => estadoPorUmbral(p, { atencion: 70, critico: 85, sentido: 'alto' });

/** Recetas: qué widgets arma cada módulo a partir de sus fuentes. */
const RECETAS = {
  maritimo: ({ fuentes, filas, series }) => {
    const m = fuentes.maritimo || {};
    const ocup = m.ocupacion;
    return [
      kpisDeCatalogo('maritimo', filas, series, ['maritimo.naves_fondeadas', 'maritimo.espera_fondeo_prom_min', 'maritimo.naves_atracadas', 'maritimo.ocupacion_muelles_pct', 'maritimo.espera_fondeo_max_min', 'maritimo.naves_criticas']),
      listaDe(m.resumen?.fondeo?.cola, { id: 'fondeo', titulo: 'Cola de fondeo', subtitulo: 'Naves esperando, la más antigua primero' }, (n) => ({
        titulo: texto(n.nombre || n.mmsi), detalle: texto(n.destino), valor: minutosTexto(n.minutos),
        estado: num(n.minutos) >= 1440 ? 'critico' : num(n.minutos) >= 480 ? 'atencion' : 'neutro',
      })),
      listaDe(fuentes.llegadas?.naves, { id: 'llegadas', titulo: 'Próximas llegadas', subtitulo: 'Line-up de las próximas 72 h' }, (n) => ({
        titulo: texto(n.motonave), detalle: [texto(n.instalacion), texto(n.agencia)].filter(Boolean).join(' · '),
        valor: num(n.minutosParaEta) !== null ? (n.minutosParaEta <= 0 ? 'En puerto' : `ETA ${minutosTexto(n.minutosParaEta)}`) : texto(n.situacion),
        estado: 'neutro',
      })),
      ocup?.terminales?.length ? graficaDe({
        labels: ocup.terminales.map((t) => t.nombre),
        series: [{ nombre: 'Ocupados', valores: ocup.terminales.map((t) => (t.muelles || []).filter((x) => x.ocupado).length) },
          { nombre: 'Libres', valores: ocup.terminales.map((t) => (t.muelles || []).filter((x) => !x.ocupado && !x.enMantenimiento).length) }],
      }, { id: 'muelles', titulo: 'Muelles por terminal', forma: 'barras', unidad: 'muelles' }) : null,
    ];
  },

  gate: ({ fuentes, filas, series }) => {
    const g = fuentes.gate || {};
    return [
      kpisDeCatalogo('gate', filas, series, ['gate.en_cola', 'gate.espera_prom_min', 'gate.retrasadas', 'gate.cumplimiento_pct', 'gate.retenidos', 'gate.citas_total']),
      listaDe(g.alertas?.lista || g.alertas, { id: 'alertas', titulo: 'Esperas excedidas', subtitulo: 'Unidades por encima del umbral de espera' }, (a) => ({
        titulo: texto(a.placa) || texto(a.tipo), detalle: texto(a.terminal), valor: minutosTexto(a.minutos), estado: estadoDesdeSemaforo(a.severidad),
      })),
      graficaDe(g.citas12h, { id: 'citas12h', titulo: 'Citas próximas 12 h', forma: 'barras', unidad: 'citas' }),
    ];
  },

  bodegas: ({ fuentes }) => {
    const b = fuentes.bodegas || {};
    return [
      kpisDeTablero(b.kpis),
      listaDe(b.saturacionBodegas, { id: 'saturacion', titulo: 'Ocupación de bodegas', subtitulo: 'Las más llenas primero' }, (x) => {
        const p = num(x.ocupacionPct ?? x.porcentaje);
        return { titulo: texto(x.nombre || x.codigo), detalle: texto(x.codigo !== x.nombre ? x.codigo : ''), valor: p, unidad: '%', progreso: p, estado: estadoPorPct(p) };
      }),
      graficaDe(b.distribucionPorCarga, { id: 'carga', titulo: 'Inventario por tipo de carga', forma: 'dona', unidad: 't' }),
    ];
  },

  contenedores: ({ fuentes }) => {
    const c = fuentes.contenedores || {};
    return [
      kpisDeTablero(c.kpis),
      listaDe(c.saturacionPatios, { id: 'patios', titulo: 'Saturación de patios' }, (p) => {
        const v = num(p.porcentaje);
        return { titulo: texto(p.nombre), detalle: texto(p.estado), valor: v, unidad: '%', progreso: v, estado: estadoPorPct(v) };
      }),
      graficaDe(c.freeTimeDistribucion, { id: 'freetime', titulo: 'Free time', forma: 'barras', unidad: 'contenedores' }),
    ];
  },

  granel: ({ fuentes }) => {
    const g = fuentes.granel || {};
    return [
      kpisDeTablero(g.kpis),
      graficaDe(g.tendencia, { id: 'tendencia', titulo: 'Movimiento por hora (24 h)', forma: 'linea', unidad: 't' }),
      listaDe(g.bodegas, { id: 'bodegas', titulo: 'Bodegas y silos de granel' }, (b) => ({
        titulo: texto(b.nombre), detalle: texto(b.producto), valor: num(b.porcentaje), unidad: '%', progreso: num(b.porcentaje), estado: estadoDesdeSemaforo(b.semaforo),
      })),
      graficaDe(g.productos, { id: 'productos', titulo: 'Por producto', forma: 'dona', unidad: 't' }),
    ];
  },

  suelta: ({ fuentes }) => {
    const s = fuentes.suelta || {};
    return [
      kpisDeTablero(s.kpis),
      listaDe(s.roro, { id: 'roro', titulo: 'Operaciones RoRo' }, (r) => ({
        titulo: texto(r.motonave), detalle: [texto(r.terminal), texto(r.estado)].filter(Boolean).join(' · '),
        valor: num(r.avancePct), unidad: '%', progreso: num(r.avancePct), estado: r.activa ? 'ok' : 'neutro',
      })),
      graficaDe(s.composicion, { id: 'composicion', titulo: 'Composición de la carga', forma: 'dona' }),
    ];
  },

  capacidad: ({ fuentes }) => {
    const c = fuentes.capacidad || {};
    return [
      kpisDeTablero(c.kpis),
      listaDe(c.nodos, { id: 'nodos', titulo: 'Nodos más saturados' }, (n) => ({
        titulo: texto(n.nombre), detalle: texto(n.categoriaNombre || n.categoria), valor: num(n.ocupacionPct), unidad: '%',
        progreso: num(n.ocupacionPct), estado: estadoDesdeSemaforo(n.semaforo),
      })),
      graficaDe(c.saturacion, { id: 'saturacion', titulo: 'Saturación por categoría', forma: 'barras', unidad: '%' }),
    ];
  },

  gnl: ({ fuentes }) => {
    const g = fuentes.gnl || {};
    const sum = (a) => (a || []).reduce((t, v) => t + (num(v) || 0), 0);
    const ultimo = (a) => [...(a || [])].reverse().map(num).find((v) => v !== null) ?? null;
    const items = (g.volumenM3?.length ? [
      { id: 'gnl.volumen', titulo: 'Volumen 24 h', valor: Math.round(sum(g.volumenM3)), unidad: 'm³', estado: 'neutro', simulado: !!g.simulado, serie: submuestrear(g.volumenM3) },
      { id: 'gnl.energia', titulo: 'Energía 24 h', valor: redondear(sum(g.energiaMmbtu), 1), unidad: 'MMBTU', estado: 'neutro', simulado: !!g.simulado, serie: submuestrear(g.energiaMmbtu) },
      { id: 'gnl.presion', titulo: 'Presión actual', valor: ultimo(g.presionPsi), unidad: 'psi', estado: 'neutro', simulado: !!g.simulado, serie: submuestrear(g.presionPsi) },
      { id: 'gnl.temperatura', titulo: 'Temperatura actual', valor: ultimo(g.temperaturaC), unidad: '°C', estado: 'neutro', simulado: !!g.simulado, serie: submuestrear(g.temperaturaC) },
      { id: 'gnl.alarmas', titulo: 'Alarmas 24 h', valor: Array.isArray(g.alarmas) ? sum(g.alarmas) : num(g.alarmas) ?? 0, unidad: 'alarmas',
        estado: (Array.isArray(g.alarmas) ? sum(g.alarmas) : num(g.alarmas)) > 0 ? 'atencion' : 'ok', simulado: !!g.simulado },
    ].filter((k) => k.valor !== null) : []);
    return [
      items.length ? { tipo: 'kpis', id: 'kpis.gnl', titulo: 'Indicadores', items } : null,
      graficaDe({ labels: g.labels, valores: g.volumenM3 }, { id: 'volumen', titulo: 'Volumen por hora', forma: 'linea', unidad: 'm³' }),
      listaDe(g.porBrazo, { id: 'brazos', titulo: 'Volumen por brazo (24 h)' }, (b) => ({ titulo: texto(b.brazo), valor: Math.round(num(b.total) || 0), unidad: 'm³', estado: 'neutro' })),
    ];
  },

  noticias: ({ fuentes }) => {
    const n = fuentes.noticias || {};
    return [
      kpisDeTablero(n.kpis),
      listaDe(n.noticias, { id: 'noticias', titulo: 'Últimas noticias' }, (x) => ({
        titulo: texto(x.titulo), detalle: [texto(x.medio), texto(x.categoriaNombre)].filter(Boolean).join(' · '),
        valor: x.delPuerto ? 'Puerto' : '', estado: x.delPuerto ? 'ok' : 'neutro', url: /^https?:\/\//.test(texto(x.url)) ? texto(x.url) : undefined, fecha: x.fecha || undefined,
      })),
      listaDe(n.corredores, { id: 'corredores', titulo: 'Corredores viales' }, (c) => ({
        titulo: texto(c.corredor), detalle: texto(c.estado), valor: num(c.eventos), unidad: 'eventos', estado: estadoDesdeSemaforo(c.semaforo),
      })),
    ];
  },

  mapa: ({ fuentes, filas, series }) => [
    kpisDeCatalogo('viales', filas, series, null, 'Corredores viales'),
    kpisDeCatalogo('maritimo', filas, series, ['maritimo.naves_fondeadas', 'maritimo.naves_atracadas', 'maritimo.ocupacion_muelles_pct'], 'Bahía'),
    listaDe(fuentes.viales?.eventos, { id: 'eventos', titulo: 'Eventos viales vigentes' }, (e) => ({
      titulo: texto(e.descripcion || e.tipoEvento), detalle: [texto(e.corredorVial), texto(e.sector), texto(e.tipoEvento)].filter(Boolean).join(' · '),
      estado: ['CIERRE_VIAL', 'ACCIDENTE'].includes(String(e.tipoEvento).toUpperCase()) || estadoDesdeSemaforo(e.nivelSeveridad) === 'critico' ? 'critico' : 'atencion',
    })),
  ],

  generico: () => [],
};

/**
 * Tablero móvil de una pestaña.
 * @param {{ puerto, pestana, fuentes: Object, filas?: Array (foto KPI del catálogo), series?: Map<codigo, filas[]>, ahora?: Date }} p
 */
function armarTablero({ puerto, pestana, fuentes = {}, filas = [], series = new Map(), ahora = new Date() }) {
  const modulo = moduloDePestana(pestana);
  const receta = RECETAS[modulo] || RECETAS.generico;
  let widgets = [];
  try {
    widgets = receta({ fuentes, filas, series }).filter(Boolean);
  } catch {
    widgets = [];
  }
  const simulado = widgets.some((w) => w.tipo === 'kpis' && w.items.some((k) => k.simulado))
    || Object.values(fuentes).some((f) => f && (f.simulado || f.origen?.simulado));
  return { puerto, pestana: String(pestana || '').toUpperCase(), modulo, generadoEn: ahora.toISOString(), simulado: !!simulado, widgets };
}

module.exports = {
  MODULO_POR_PESTANA, FUENTES_POR_MODULO, MAX_ITEMS, PUNTOS_SPARK, MAX_KPIS,
  moduloDePestana, estadoDesdeBorde, estadoPorUmbral, estadoDesdeSemaforo, submuestrear, primeraSerie,
  kpiDesdeTarjeta, kpiDesdeCatalogo, graficaDe, listaDe, kpisDeTablero, kpisDeCatalogo, minutosTexto, armarTablero, RECETAS,
};
