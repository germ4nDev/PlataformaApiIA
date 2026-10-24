/*
    Author: German Valencia
    Pattern: PORTTOS Núcleo puro (AD-16) - Piezas comunes de los tableros por pestaña
    Description: Sin base de datos ni red. Lo usan los núcleos de Granel, Carga suelta, Capacidad y Noticias.
      - kpi(): forma única de una tarjeta KPI (la que pinta kpi-card-tcl en el front).
      - semaforo(): verde < 70 % ≤ amarillo < 85 % ≤ rojo (misma regla en todas las pestañas).
      - inicioDiaColombia(), horaColombia(), etiquetaHora(): Colombia es UTC-5 sin horario de verano.
      - serieHoraria(): suma por hora de las últimas N horas, con las horas vacías en 0.
*/

const UMBRALES_SATURACION = Object.freeze({ atencion: 70, critico: 85 });
const OFFSET_COLOMBIA_MS = -5 * 3600000;

const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const redondear = (v, d = 0) => (v === null ? null : Math.round(v * 10 ** d) / 10 ** d);
const suma = (lista, f = (x) => x) => lista.reduce((t, x) => t + (num(f(x)) || 0), 0);
const pct = (parte, total) => (total > 0 ? redondear((parte / total) * 100, 1) : 0);

/** Tarjeta KPI (contrato de kpi-card-tcl). Con simulado=true el subtítulo lo dice. */
function kpi({ titulo, valor, unidad = '', subtitulo = '', colorBorde = 'borde-cyan', icono = 'feather icon-activity', simulado = false, valorCompleto = null,
  desglose = null, serie = null, definicion = null, formula = null, umbrales = null }) {
  // Lo opcional (desglose, serie, definición...) alimenta la vista ampliada del KPI (contrato de kpi-card-tcl)
  const extras = Object.fromEntries(Object.entries({ valorCompleto, desglose, serie, definicion, formula, umbrales }).filter(([, v]) => v !== null && v !== undefined));
  return {
    titulo, valor: valor ?? 0, unidad, colorBorde, icono, simulado: !!simulado,
    ...extras,
    subtitulo: simulado ? [subtitulo, 'SIMULADO'].filter(Boolean).join(' · ') : subtitulo,
  };
}

/** verde | amarillo | rojo según el porcentaje de ocupación. */
const semaforo = (porcentaje) => {
  const p = num(porcentaje);
  if (p === null) return 'gris';
  return p >= UMBRALES_SATURACION.critico ? 'rojo' : p >= UMBRALES_SATURACION.atencion ? 'amarillo' : 'verde';
};

/** Inicio del día de hoy en Colombia, como ms UTC. */
function inicioDiaColombia(ahoraMs) {
  const local = ahoraMs + OFFSET_COLOMBIA_MS;
  return local - (local % 86400000) - OFFSET_COLOMBIA_MS;
}

const horaColombia = (ms) => new Date(ms + OFFSET_COLOMBIA_MS).getUTCHours();
const etiquetaHora = (ms) => `${String(horaColombia(ms)).padStart(2, '0')}h`;
const inicioHora = (ms) => ms - (ms % 3600000);

/**
 * Serie de las últimas 'horas' horas (la actual incluida) a partir de filas { hora (ISO), valor }.
 * @returns {{ horasMs:number[], labels:string[], valores:number[] }}
 */
function serieHoraria(filas, ahoraMs, horas = 24, campoHora = 'hora', campoValor = 'cantidad') {
  const fin = inicioHora(ahoraMs);
  const horasMs = Array.from({ length: horas }, (_, i) => fin - (horas - 1 - i) * 3600000);
  const indice = new Map(horasMs.map((h, i) => [h, i]));
  const valores = horasMs.map(() => 0);
  for (const f of filas || []) {
    const h = inicioHora(Date.parse(f[campoHora]));
    if (indice.has(h)) valores[indice.get(h)] += num(f[campoValor]) || 0;
  }
  return { horasMs, labels: horasMs.map(etiquetaHora), valores: valores.map((v) => redondear(v, 1)) };
}

/** Agrupa y suma: [{clave, valor}] ordenado de mayor a menor. */
function agrupar(lista, clave, valor) {
  const m = new Map();
  for (const x of lista || []) {
    const k = clave(x) || 'Sin dato';
    m.set(k, (m.get(k) || 0) + (num(valor(x)) || 0));
  }
  return [...m.entries()].map(([k, v]) => ({ clave: k, valor: redondear(v, 1) })).sort((a, b) => b.valor - a.valor);
}

/** Histórico mensual de Supertransporte: filas { anio, mes, tipo_carga, toneladas } → series por grupo. */
function historicoMensual(filas, grupos, meses = 12) {
  const periodos = [...new Set((filas || []).map((f) => `${f.anio}-${String(f.mes).padStart(2, '0')}`))].sort().slice(-meses);
  const series = Object.fromEntries(Object.keys(grupos).map((g) => [g, periodos.map(() => 0)]));
  for (const f of filas || []) {
    const i = periodos.indexOf(`${f.anio}-${String(f.mes).padStart(2, '0')}`);
    if (i < 0) continue;
    const tipo = String(f.tipo_carga || '').toUpperCase();
    for (const [g, prueba] of Object.entries(grupos)) if (prueba(tipo)) series[g][i] += num(f.toneladas) || 0;
  }
  return { labels: periodos, series: Object.fromEntries(Object.entries(series).map(([g, v]) => [g, v.map((x) => Math.round(x))])) };
}

module.exports = {
  UMBRALES_SATURACION, num, redondear, suma, pct, kpi, semaforo,
  inicioDiaColombia, horaColombia, etiquetaHora, inicioHora, serieHoraria, agrupar, historicoMensual,
};
