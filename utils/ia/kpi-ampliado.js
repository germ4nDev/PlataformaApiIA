/*
    Author: German Valencia
    Pattern: PORTTOS Core puro (AD-16) - Vista ampliada de un KPI: historia, tendencia y proyección (regla 30, CC-313)
    Description: Sin base de datos ni red. Con los promedios por hora y por día de las fotos de KPI (TCL_SnapshotsKpi) de UN
      indicador arma lo que muestra la tarjeta al ampliarse:
        series        '24h' (por hora) · '7d' (tramos de 6 h) · '30d' (por día), etiquetas de tiempo en hora de Colombia
        tendencias    las tres ventanas de utils/ia/tendencias: dirección, efecto, cambio %, promedio y referencia
        proyecciones  '24h' (desde las últimas 72 h por hora) y '7d' (desde los últimos 30 días): extrapolación lineal de la
                      tendencia con su banda (±2 desviaciones del ajuste) y, si aplica, cuándo entraría en zona de atención o
                      crítica. Sin historia suficiente, no se proyecta (motivo HISTORIA_INSUFICIENTE con puntos y mínimo).
      Sin textos (regla 22): solo códigos y cifras; la web arma las frases con sus llaves (KPI_CARD_TCL.*) y la definición con la
      familia KPI_CARD_TCL.DEFINITION.<KPI>. El widget se traduce al catálogo con WIDGET_KPI (utils/ia/por-que); fuera, SIN_CATALOGO.
*/
const { POR_CODIGO, umbralesDe } = require('./catalogo-kpi');
const { WIDGET_KPI } = require('./por-que');
const { tendenciaKpi, tramos, CODIGOS_VENTANA } = require('./tendencias');

const HORA = 3600000;
const DIA = 24 * HORA;
const COLOMBIA_MS = -5 * HORA;          // Colombia no cambia de hora
const BANDA_DESVIACIONES = 2;

/** Rangos de la serie: de dónde salen los datos, cuánto abarcan y cada cuánto un punto. */
const RANGOS = Object.freeze([
  { codigo: '24h', fuente: 'hora', duracion: DIA, paso: HORA },
  { codigo: '7d', fuente: 'hora', duracion: 7 * DIA, paso: 6 * HORA },
  { codigo: '30d', fuente: 'dia', duracion: 30 * DIA, paso: DIA },
]);

/** Proyecciones: con cuánta historia, a qué horizonte y con cuántos puntos mínimos. */
const PROYECCIONES = Object.freeze([
  { codigo: '24h', fuente: 'hora', base: 3 * DIA, paso: HORA, pasos: 24, minimo: 24 },
  { codigo: '7d', fuente: 'dia', base: 30 * DIA, paso: DIA, pasos: 7, minimo: 10 },
]);

const dos = (n) => String(n).padStart(2, '0');
function etiqueta(t, paso) {
  const d = new Date(t + COLOMBIA_MS);
  const fecha = `${dos(d.getUTCDate())}/${dos(d.getUTCMonth() + 1)}`;
  if (paso >= DIA) return fecha;
  if (paso > HORA) return `${fecha} ${dos(d.getUTCHours())}h`;
  return `${dos(d.getUTCHours())}:00`;
}
const redondear = (v) => (v === null || !Number.isFinite(v) ? null : Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10);

/** Límites razonables de un KPI: un porcentaje entre 0 y 100; conteos, toneladas y tiempos no bajan de 0. */
function acotar(v, unidad) {
  if (v === null) return null;
  const x = Math.max(0, v);
  return unidad === '%' ? Math.min(100, x) : x;
}

/** Fin del tramo actual (la hora o el día en curso incluidos). */
const finDe = (ahoraMs, paso) => ahoraMs - (ahoraMs % paso) + paso;

/** Serie de un rango: { labels, valores } (null donde no hubo foto). */
function serieRango(filas, rango, ahoraMs) {
  const hasta = finDe(ahoraMs, rango.fuente === 'dia' ? DIA : HORA);
  const puntos = tramos(filas, hasta - rango.duracion, hasta, rango.paso);
  return { labels: puntos.map((p) => etiqueta(p.t, rango.paso)), valores: puntos.map((p) => redondear(p.valor)) };
}

/**
 * Recta de mínimos cuadrados sobre puntos { t, valor } y su extrapolación a `pasos` tramos de `paso` ms.
 * @returns {{ t:number[], valores:number[], min:number[], max:number[], pendiente:number, desviacion:number } | null}
 */
function proyectar(puntos, paso, pasos, unidad) {
  const p = puntos.filter((x) => x.valor !== null && Number.isFinite(x.valor));
  if (p.length < 2) return null;
  const t0 = p[0].t;
  const xs = p.map((x) => (x.t - t0) / paso);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = p.reduce((a, x) => a + x.valor, 0) / p.length;
  const den = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  const b = den === 0 ? 0 : xs.reduce((a, x, i) => a + (x - mx) * (p[i].valor - my), 0) / den;
  const a = my - b * mx;
  const residuos = p.map((x, i) => x.valor - (a + b * xs[i]));
  const desviacion = Math.sqrt(residuos.reduce((s, r) => s + r * r, 0) / Math.max(1, p.length - 2));
  const ultimo = p[p.length - 1].t;
  const t = [];
  const valores = [];
  const min = [];
  const max = [];
  for (let i = 1; i <= pasos; i++) {
    const ti = ultimo + i * paso;
    const y = a + b * ((ti - t0) / paso);
    t.push(ti);
    valores.push(redondear(acotar(y, unidad)));
    min.push(redondear(acotar(y - BANDA_DESVIACIONES * desviacion, unidad)));
    max.push(redondear(acotar(y + BANDA_DESVIACIONES * desviacion, unidad)));
  }
  return { t, valores, min, max, pendiente: b, desviacion };
}

/** Nivel de un valor frente a los umbrales del sistema: 'critico' | 'atencion' | null. */
function nivelDe(v, umbrales) {
  if (!umbrales || v === null || v === undefined) return null;
  const pasa = (lim) => (umbrales.sentido === 'bajo' ? v <= lim : v >= lim);
  return pasa(umbrales.critico) ? 'critico' : pasa(umbrales.atencion) ? 'atencion' : null;
}

/**
 * ¿Cuándo entra la proyección a un nivel peor que el del último valor observado? (crítico antes que atención).
 * Si ya está en ese nivel no hay cruce (la proyección lleva nivelFinal: seguiría ahí).
 */
const RANGO_NIVEL = { null: 0, atencion: 1, critico: 2 };
function cruceUmbral(proy, umbrales, ultimoObservado = null) {
  if (!umbrales || !proy) return null;
  const actual = RANGO_NIVEL[nivelDe(ultimoObservado, umbrales)];
  const i = proy.valores.findIndex((v) => RANGO_NIVEL[nivelDe(v, umbrales)] > actual);
  return i >= 0 ? { nivel: nivelDe(proy.valores[i], umbrales), indice: i, t: proy.t[i] } : null;
}

/**
 * Proyección de un horizonte. Sin textos (regla 22): la web arma la frase con sus llaves a partir de los códigos y las cifras.
 * motivo: 'HISTORIA_INSUFICIENTE' (puntos/minimo) | 'SIN_DATOS'.
 */
function proyeccionDe(kpi, filas, def, ahoraMs) {
  const base = tramos(filas[def.fuente] || [], finDe(ahoraMs, def.paso) - def.base, finDe(ahoraMs, def.paso), def.paso)
    .filter((x) => x.valor !== null);
  const meta = { ventana: def.codigo, metodo: 'tendencia_lineal', minimo: def.minimo, puntos: base.length };
  if (base.length < def.minimo) return { ...meta, disponible: false, motivo: 'HISTORIA_INSUFICIENTE' };
  const proy = proyectar(base, def.paso, def.pasos, kpi.unidad);
  if (!proy) return { ...meta, disponible: false, motivo: 'SIN_DATOS' };
  const umbrales = umbralesDe(kpi.codigo);
  const final = proy.valores[proy.valores.length - 1];
  const cruce = cruceUmbral(proy, umbrales, base[base.length - 1].valor);
  return {
    ...meta, disponible: true,
    final, minFinal: proy.min[proy.min.length - 1], maxFinal: proy.max[proy.max.length - 1],
    cruce: cruce ? { nivel: cruce.nivel, cuando: etiqueta(cruce.t, def.paso), porHora: def.paso < DIA } : null,
    nivelFinal: cruce ? null : nivelDe(final, umbrales),
    labels: proy.t.map((t) => etiqueta(t, def.paso)), valores: proy.valores, min: proy.min, max: proy.max,
  };
}

/**
 * Vista ampliada de la tarjeta.
 * @param {{ widget:string, hora?:Array<{codigoKpi,periodo,prom,simulado?}>, dia?:Array<{codigoKpi,periodo,prom,simulado?}> }} p
 *   hora y dia pueden traer todos los KPI del puerto: se filtran por el código del catálogo.
 */
function armarKpiAmpliado({ widget, hora = [], dia = [] }, ahora = new Date()) {
  const codigo = WIDGET_KPI[widget] || null;
  const kpi = codigo ? POR_CODIGO.get(codigo) : null;
  if (!kpi) return { widget, codigo: null, disponible: false, conPorQue: false, motivo: 'SIN_CATALOGO' };
  const ahoraMs = ahora.getTime();
  const filas = {
    hora: hora.filter((f) => f.codigoKpi === codigo),
    dia: dia.filter((f) => f.codigoKpi === codigo),
  };
  const series = Object.fromEntries(RANGOS.map((r) => [r.codigo, serieRango(filas[r.fuente], r, ahoraMs)]));
  const tendencias = CODIGOS_VENTANA.map((w) => {
    const t = tendenciaKpi(kpi, w, filas, ahora);
    return { ventana: w, direccion: t.direccion, efecto: t.efecto, cambioPct: t.cambioPct ?? null, actual: t.actual, referencia: t.referencia };
  });
  return {
    widget, codigo, disponible: true, conPorQue: true, conHistoria: filas.hora.length + filas.dia.length > 0,
    unidad: kpi.unidad, umbrales: umbralesDe(codigo),
    simulado: [...filas.hora, ...filas.dia].some((f) => f.simulado),
    series, tendencias,
    proyecciones: Object.fromEntries(PROYECCIONES.map((d) => [d.codigo, proyeccionDe(kpi, filas, d, ahoraMs)])),
  };
}

const MIN_MESES = 6;
const etiquetaMes = (anio, mes) => `${String(mes).padStart(2, '0')}/${String(anio).slice(2)}`;

/**
 * KPI con historia mensual en su fuente (los de carga de Supertransporte): agrega la serie '24m' y la proyección '3m'
 * (los próximos 3 meses por la tendencia de los meses publicados). puntos = [{ anio, mes, valor }] ascendentes.
 */
function agregarMensual(r, puntos) {
  if (!r?.disponible || !Array.isArray(puntos) || !puntos.length) return r;
  const series = { '24m': { labels: puntos.map((p) => etiquetaMes(p.anio, p.mes)), valores: puntos.map((p) => p.valor) }, ...r.series };
  const meta = { ventana: '3m', metodo: 'tendencia_lineal', minimo: MIN_MESES, puntos: puntos.length };
  let proy3m = { ...meta, disponible: false, motivo: 'HISTORIA_INSUFICIENTE' };
  const p = puntos.length >= MIN_MESES ? proyectar(puntos.map((x, i) => ({ t: i, valor: x.valor })), 1, 3, r.unidad) : null;
  if (p) {
    const ultimo = puntos[puntos.length - 1];
    const labels = [1, 2, 3].map((i) => { const m = ultimo.anio * 12 + ultimo.mes - 1 + i; return etiquetaMes(Math.floor(m / 12), (m % 12) + 1); });
    proy3m = {
      ...meta, disponible: true, final: p.valores[2], minFinal: p.min[2], maxFinal: p.max[2],
      cruce: null, nivelFinal: null, labels, valores: p.valores, min: p.min, max: p.max,
    };
  }
  return { ...r, conHistoria: true, historiaMensual: true, series, proyecciones: { '3m': proy3m, ...r.proyecciones } };
}

/** Llave i18n de la definición de un KPI del catálogo (familia PORTTOS.WIDGETS.SHARED.KPI_CARD_TCL.DEFINITION.*). */
const llaveDefinicion = (codigo) => `PORTTOS.WIDGETS.SHARED.KPI_CARD_TCL.DEFINITION.${String(codigo).toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;

module.exports = { RANGOS, PROYECCIONES, proyectar, nivelDe, cruceUmbral, armarKpiAmpliado, agregarMensual, etiqueta, llaveDefinicion };
