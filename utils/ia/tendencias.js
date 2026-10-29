/*
    Author: German Valencia
    Pattern: PORTTOS Core puro (AD-16) - Tendencias de 24 h, 7 días y 30 días (capa de IA, fase 4)
    Description: Sin base de datos ni red. A partir de los promedios por hora y por día de las fotos de KPI
      (TCL_SnapshotsKpi) calcula, por KPI y ventana:
        actual       promedio de la ventana        referencia  promedio de la ventana con que se compara
        cambioPct    actual frente a referencia    pendienteDia  recta de mínimos cuadrados (unidades por día)
        direccion    sube | baja | estable | sin_datos            efecto  empeora | mejora | neutral | estable
        relevante    vale la pena mostrarla o contarla al analista  lectura  frase lista para el tablero
        puntos       serie para la mini-gráfica (24 horas · 28 tramos de 6 h · 30 días)
      Comparación (diseño «Capa de análisis con IA»):
        24h  últimas 24 h  frente a  las mismas 24 h de la semana anterior
        7d   últimos 7 días frente a los 7 días anteriores
        30d  últimos 30 días frente a los 30 días anteriores
      Sin referencia (menos historia), la dirección sale de la pendiente dentro de la ventana.
      Qué es «empeorar» por KPI: DESEABLE (bajo = mejor si baja). Un KPI con umbral 'alto' (saturación, espera
      del gate) se considera deseable bajo; los demás sin entrada son neutrales (solo se informa la dirección).
      Cada tendencia tiene idEvidencia 'tendencia.<codigoKpi>.<ventana>' para que el resumen la cite.
*/
const { CATALOGO_KPI, umbralesDe } = require('./catalogo-kpi');

const HORA = 3600000;
const DIA = 24 * HORA;
const SEMANA = 7 * DIA;

/** ventana → cómo se calcula. */
const VENTANAS = Object.freeze({
  '24h': { nombre: '24 h', dias: 1, fuente: 'hora', duracion: DIA, desfaseRef: SEMANA, tramo: HORA, contra: 'las mismas 24 h de la semana anterior' },
  '7d': { nombre: '7 días', dias: 7, fuente: 'hora', duracion: SEMANA, desfaseRef: SEMANA, tramo: 6 * HORA, contra: 'los 7 días anteriores' },
  '30d': { nombre: '30 días', dias: 30, fuente: 'dia', duracion: 30 * DIA, desfaseRef: 30 * DIA, tramo: DIA, contra: 'los 30 días anteriores' },
});
const CODIGOS_VENTANA = Object.keys(VENTANAS);

const UMBRAL_ESTABLE_PCT = 5;       // |cambio| menor = estable
const UMBRAL_RELEVANTE_PCT = 15;    // |cambio| desde el que una tendencia que empeora o mejora es relevante
const UMBRAL_NEUTRAL_PCT = 30;      // para KPI neutrales
const COBERTURA_MINIMA = 0.3;       // fracción de tramos con dato para no decir «sin datos»

/** Sentido deseable por KPI: 'bajo' = mejor cuando baja · 'alto' = mejor cuando sube. */
const DESEABLE = Object.freeze({
  'maritimo.naves_fondeadas': 'bajo', 'maritimo.espera_fondeo_prom_min': 'bajo', 'maritimo.espera_fondeo_max_min': 'bajo',
  'maritimo.naves_criticas': 'bajo',
  'gate.en_cola': 'bajo', 'gate.retrasadas': 'bajo', 'gate.retenidos': 'bajo', 'gate.alertas_criticas': 'bajo',
  'gate.cumplimiento_pct': 'alto', 'gate.aprobacion_pct': 'alto',
  'contenedores.cargados_pendientes': 'bajo', 'contenedores.vacios_devolver': 'bajo', 'contenedores.free_time_vencido': 'bajo',
  'bodegas.en_alerta': 'bajo',
  'granel.agricola_t': 'alto', 'granel.mineral_t': 'alto', 'granel.liquido_t': 'alto', 'suelta.breakbulk_t': 'alto',
  'capacidad.nodos_criticos': 'bajo',
  'viales.eventos_vigentes': 'bajo', 'viales.cierres': 'bajo', 'viales.accidentes': 'bajo',
});

const deseableDe = (codigo) => DESEABLE[codigo] || (umbralesDe(codigo)?.sentido === 'alto' ? 'bajo' : umbralesDe(codigo)?.sentido === 'bajo' ? 'alto' : null);
const idTendencia = (codigo, ventana) => `tendencia.${codigo}.${ventana}`;
const redondear = (v, d = 1) => (v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);
const media = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Pendiente (unidades por día) de puntos { t (ms), valor }. */
function pendienteDia(puntos) {
  const p = puntos.filter((x) => Number.isFinite(x.valor));
  if (p.length < 2) return null;
  const xs = p.map((x) => (x.t - p[0].t) / DIA);
  const mx = media(xs);
  const my = media(p.map((x) => x.valor));
  const den = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  return den === 0 ? null : xs.reduce((a, x, i) => a + (x - mx) * (p[i].valor - my), 0) / den;
}

/** Agrupa filas { periodo, prom } en tramos de 'tramo' ms entre [desde, hasta). */
function tramos(filas, desde, hasta, tramo) {
  const n = Math.round((hasta - desde) / tramo);
  const sumas = Array.from({ length: n }, () => ({ s: 0, c: 0 }));
  filas.forEach((f) => {
    const t = Date.parse(f.periodo);
    if (!(t >= desde && t < hasta) || !Number.isFinite(Number(f.prom))) return;
    const i = Math.min(n - 1, Math.floor((t - desde) / tramo));
    sumas[i].s += Number(f.prom); sumas[i].c += 1;
  });
  return sumas.map((x, i) => ({ t: desde + i * tramo, valor: x.c ? x.s / x.c : null }));
}

const formato = (v, unidad) => {
  if (v === null) return '—';
  const n = Math.abs(v) >= 100 ? Math.round(v) : redondear(v, 1);
  return `${String(n).replace('.', ',')}${unidad === '%' ? ' %' : unidad ? ` ${unidad}` : ''}`;
};

/**
 * Tendencia de un KPI en una ventana.
 * @param {{codigo:string, titulo:string, unidad:string}} kpi
 * @param {{hora:Array<{periodo,prom,simulado?}>, dia:Array<{periodo,prom,simulado?}>}} filas   del KPI
 */
function tendenciaKpi(kpi, ventana, filas, ahora = new Date()) {
  const v = VENTANAS[ventana];
  const fuente = filas[v.fuente] || [];
  const base = v.fuente === 'dia' ? ahora.getTime() - (ahora.getTime() % DIA) + DIA : ahora.getTime() - (ahora.getTime() % HORA) + HORA;
  const desde = base - v.duracion;
  const puntos = tramos(fuente, desde, base, v.tramo);
  const actuales = tramos(fuente, desde, base, v.fuente === 'dia' ? DIA : HORA).filter((p) => p.valor !== null);
  const referencias = tramos(fuente, desde - v.desfaseRef, base - v.desfaseRef, v.fuente === 'dia' ? DIA : HORA).filter((p) => p.valor !== null);
  const totalTramos = Math.round(v.duracion / (v.fuente === 'dia' ? DIA : HORA));
  const cobertura = actuales.length / totalTramos;
  const actual = media(actuales.map((p) => p.valor));
  const referencia = referencias.length / totalTramos >= COBERTURA_MINIMA ? media(referencias.map((p) => p.valor)) : null;
  const pendiente = pendienteDia(actuales);
  const ultimo = actuales.length ? actuales[actuales.length - 1].valor : null;
  const simulado = fuente.some((f) => f.simulado && Date.parse(f.periodo) >= desde);
  const deseable = deseableDe(kpi.codigo);
  const umbrales = umbralesDe(kpi.codigo);

  let cambioPct = null;
  if (actual !== null && referencia !== null) {
    if (referencia !== 0) cambioPct = ((actual - referencia) / Math.abs(referencia)) * 100;
    else if (actual === 0) cambioPct = 0;
  }
  // Sin referencia: el cambio dentro de la ventana según la pendiente, relativo al promedio
  const cambioInterno = pendiente !== null && actual ? ((pendiente * v.dias) / Math.abs(actual)) * 100 : null;
  const cambio = cambioPct ?? cambioInterno;

  let direccion = 'sin_datos';
  if (cobertura >= COBERTURA_MINIMA && actual !== null) {
    if (cambio === null) direccion = referencia !== null && actual > referencia ? 'sube' : referencia !== null && actual < referencia ? 'baja' : 'estable';
    else direccion = Math.abs(cambio) < UMBRAL_ESTABLE_PCT ? 'estable' : cambio > 0 ? 'sube' : 'baja';
  }
  let efecto = 'estable';
  if (direccion === 'sin_datos') efecto = 'sin_datos';
  else if (direccion !== 'estable') efecto = !deseable ? 'neutral' : (direccion === 'baja') === (deseable === 'bajo') ? 'mejora' : 'empeora';

  const enUmbral = umbrales && ultimo !== null
    ? (umbrales.sentido === 'bajo' ? ultimo <= umbrales.atencion : ultimo >= umbrales.atencion) : false;
  const magnitud = Math.abs(cambio ?? 0);
  const relevante = direccion !== 'sin_datos' && ((efecto === 'empeora' && (magnitud >= UMBRAL_RELEVANTE_PCT || enUmbral))
    || (efecto === 'mejora' && magnitud >= UMBRAL_RELEVANTE_PCT) || (efecto === 'neutral' && magnitud >= UMBRAL_NEUTRAL_PCT));
  const puntaje = direccion === 'sin_datos' ? 0 : Math.min(200, magnitud) * (efecto === 'empeora' ? 1.5 : efecto === 'neutral' ? 0.6 : 1) + (enUmbral ? 50 : 0);

  let lectura;
  if (direccion === 'sin_datos') lectura = `${kpi.titulo}: sin datos suficientes en ${v.nombre}.`;
  else if (direccion === 'estable') lectura = `${kpi.titulo} se mantiene estable en ${v.nombre} (${formato(actual, kpi.unidad)} en promedio).`;
  else if (cambioPct !== null) {
    lectura = `${kpi.titulo} ${direccion === 'sube' ? 'subió' : 'bajó'} ${String(redondear(Math.abs(cambioPct), 0))} % en ${v.nombre} frente a ${v.contra} (${formato(referencia, kpi.unidad)} → ${formato(actual, kpi.unidad)}).`;
  } else {
    lectura = `${kpi.titulo} va ${direccion === 'sube' ? 'en aumento' : 'a la baja'} en ${v.nombre} (${formato(actual, kpi.unidad)} en promedio; aún no hay historia para comparar).`;
  }

  return {
    id: idTendencia(kpi.codigo, ventana), ventana, actual: redondear(actual, 2), referencia: redondear(referencia, 2), ultimo: redondear(ultimo, 2),
    cambioPct: redondear(cambioPct, 1), pendienteDia: redondear(pendiente, 3), cobertura: redondear(cobertura, 2),
    direccion, efecto, relevante, puntaje: redondear(puntaje, 1), enUmbral, simulado, lectura,
    puntos: puntos.map((p) => redondear(p.valor, 2)),
  };
}

/**
 * Tendencias de todos los KPI del catálogo.
 * @param {{hora:Array<{codigoKpi,periodo,prom,simulado?}>, dia:Array<{codigoKpi,periodo,prom,simulado?}>}} agregados
 * @returns {Array<{codigo, modulo, titulo, unidad, deseable, umbrales, ventanas: Object<string, object>}>}
 */
function calcularTendencias(agregados, ahora = new Date(), catalogo = CATALOGO_KPI) {
  const porKpi = (lista) => {
    const m = new Map();
    (lista || []).forEach((f) => { if (!m.has(f.codigoKpi)) m.set(f.codigoKpi, []); m.get(f.codigoKpi).push(f); });
    return m;
  };
  const hora = porKpi(agregados?.hora);
  const dia = porKpi(agregados?.dia);
  return catalogo.map((kpi) => {
    const filas = { hora: hora.get(kpi.codigo) || [], dia: dia.get(kpi.codigo) || [] };
    return {
      codigo: kpi.codigo, modulo: kpi.modulo, titulo: kpi.titulo, unidad: kpi.unidad,
      deseable: deseableDe(kpi.codigo), umbrales: umbralesDe(kpi.codigo),
      ventanas: Object.fromEntries(CODIGOS_VENTANA.map((w) => [w, tendenciaKpi(kpi, w, filas, ahora)])),
    };
  });
}

/** Las tendencias relevantes, de mayor a menor puntaje (una por KPI: la ventana con más puntaje). */
function destacadas(tendencias, limite = 8, ventanas = CODIGOS_VENTANA) {
  return tendencias
    .map((k) => {
      const mejor = ventanas.map((w) => k.ventanas[w]).filter((t) => t?.relevante).sort((a, b) => b.puntaje - a.puntaje)[0];
      return mejor ? { codigo: k.codigo, modulo: k.modulo, titulo: k.titulo, unidad: k.unidad, ...mejor } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.puntaje - a.puntaje)
    .slice(0, limite);
}

module.exports = {
  VENTANAS, CODIGOS_VENTANA, DESEABLE, UMBRAL_ESTABLE_PCT, UMBRAL_RELEVANTE_PCT,
  deseableDe, idTendencia, pendienteDia, tramos, tendenciaKpi, calcularTendencias, destacadas,
};
