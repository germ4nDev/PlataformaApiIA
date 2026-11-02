/*
    Author: German Valencia
    Pattern: PORTTOS Núcleo puro (AD-16) - Piezas del tablero móvil (app móvil)
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
      Desde OT-008 (2026-10-29) aquí solo quedan las piezas que usa utils/movil/widgets-movil.js (estados, series, KPI,
      listas y gráficas). La receta por módulo (RECETAS, armarTablero) se retiró: el tablero sale del layout de la web
      (utils/layout/layout-efectivo.js); la copia está en _respaldos/2026-10-29_layout-unico/.
*/
const { CATALOGO_KPI } = require('../ia/catalogo-kpi');

const MAX_ITEMS = 8;
const PUNTOS_SPARK = 24;

/** Pestaña de la Torre de Control → módulo del tablero móvil (solo lo informa la respuesta). Una pestaña nueva → 'generico'. */
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

const minutosTexto = (m) => {
  const v = num(m);
  if (v === null) return '';
  if (v < 60) return `${Math.round(v)} min`;
  const h = Math.floor(v / 60);
  const r = Math.round(v % 60);
  return r ? `${h} h ${r} min` : `${h} h`;
};
module.exports = {
  MODULO_POR_PESTANA, MAX_ITEMS, PUNTOS_SPARK,
  moduloDePestana, estadoDesdeBorde, estadoPorUmbral, estadoDesdeSemaforo, submuestrear, primeraSerie,
  kpiDesdeTarjeta, kpiDesdeCatalogo, graficaDe, listaDe, minutosTexto,
};
