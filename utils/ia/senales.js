/*
    Author: German Valencia
    Pattern: PORTTOS Core puro (AD-16) - Señales deterministas de la capa de IA (fase 1)
    Description: Recorre la serie de cada KPI (fotos de 15 min) y emite señales con su evidencia. Sin IA: es lo que
      decide si vale la pena llamar al analista y lo que el analista debe citar.
        umbral            el valor está sobre (o bajo) un umbral del sistema; 'cruce' si en la foto anterior no lo estaba
        fuera_de_lo_normal  lejos de su rango p10–p90 de la misma hora (±1 h) en los 7 días anteriores (≥ 8 muestras)
        aceleracion       la pendiente de la última hora es al menos el doble de la de las 2 horas anteriores
        proyeccion        a este ritmo cruza el umbral crítico en ≤ 12 h
        dato_viejo        la última foto tiene más de 45 min
      Cada señal: { id, codigoKpi, modulo, tipo, severidad: info | atencion | critica, titulo, datos, evidencia, simulado }.
      Los números de 'datos' son los que el modelo puede citar; el modelo no calcula otros.
*/
const { POR_CODIGO, umbralesDe, idEvidenciaKpi } = require('./catalogo-kpi');

const MIN = 60000;
const HORA = 60 * MIN;
const VIEJO_MS = 45 * MIN;
const PROYECCION_MAX_H = 12;
const MUESTRAS_NORMAL = 8;
const r1 = (v) => (v === null || v === undefined ? null : Math.round(v * 10) / 10);

/** Percentil con interpolación lineal. */
function percentil(valores, p) {
  const o = [...valores].sort((a, b) => a - b);
  if (!o.length) return null;
  const pos = (o.length - 1) * p;
  const base = Math.floor(pos);
  const sig = o[Math.min(base + 1, o.length - 1)];
  return o[base] + (sig - o[base]) * (pos - base);
}

/** Pendiente por hora (mínimos cuadrados) de puntos { t (ms), valor }. */
function pendienteHora(puntos) {
  const p = puntos.filter((x) => Number.isFinite(x.valor));
  if (p.length < 2) return null;
  const t0 = p[0].t;
  const xs = p.map((x) => (x.t - t0) / HORA);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = p.reduce((a, b) => a + b.valor, 0) / p.length;
  const den = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  if (den === 0) return null;
  return xs.reduce((a, x, i) => a + (x - mx) * (p[i].valor - my), 0) / den;
}

const nivel = (valor, u) => {
  if (!u || valor === null) return null;
  const sobre = (lim) => (u.sentido === 'bajo' ? valor <= lim : valor >= lim);
  if (sobre(u.critico)) return 'critica';
  if (sobre(u.atencion)) return 'atencion';
  return null;
};

/**
 * Señales de un KPI.
 * @param {string} codigo
 * @param {Array<{fecha:string, valor:number|null, simulado?:boolean}>} serie  ascendente por fecha (fotos guardadas + actual)
 * @param {Date} ahora
 */
function senalesKpi(codigo, serie, ahora = new Date()) {
  const def = POR_CODIGO.get(codigo);
  if (!def || !Array.isArray(serie) || !serie.length) return [];
  const pts = serie.map((s) => ({ t: Date.parse(s.fecha), valor: s.valor === null || s.valor === undefined ? null : Number(s.valor), simulado: !!s.simulado }))
    .filter((p) => Number.isFinite(p.t)).sort((a, b) => a.t - b.t);
  if (!pts.length) return [];
  const ultimo = pts[pts.length - 1];
  const ahoraMs = ahora.getTime();
  const evidencia = [idEvidenciaKpi(codigo)];
  const base = { codigoKpi: codigo, modulo: def.modulo, simulado: ultimo.simulado, evidencia };
  const senal = (tipo, severidad, titulo, datos) => ({ id: `senal.${codigo}.${tipo}`, tipo, severidad, titulo, datos: { ...datos, unidad: def.unidad }, ...base });
  const salida = [];

  if (ahoraMs - ultimo.t > VIEJO_MS) {
    salida.push(senal('dato_viejo', 'info', `${def.titulo}: sin foto nueva hace ${Math.round((ahoraMs - ultimo.t) / MIN)} min`, { ultimaFoto: new Date(ultimo.t).toISOString() }));
    return salida;    // con dato viejo no se evalúa lo demás
  }
  const v = Number.isFinite(ultimo.valor) ? ultimo.valor : null;
  if (v === null) return salida;

  // 1. Umbral (con cruce y persistencia)
  const u = umbralesDe(codigo);
  const nv = nivel(v, u);
  if (nv) {
    const previos = pts.slice(0, -1).filter((p) => Number.isFinite(p.valor));
    const anterior = previos.length ? previos[previos.length - 1] : null;
    const rango = (x) => ({ atencion: 1, critica: 2 }[nivel(x, u)] || 0);
    const actual = rango(v);
    const cruce = !!anterior && rango(anterior.valor) < actual;           // entró a este nivel en esta foto
    let desde = ultimo.t;                                                  // desde cuándo está en este nivel o más
    for (let i = previos.length - 1; i >= 0 && rango(previos[i].valor) >= actual; i--) desde = previos[i].t;
    const limite = nv === 'critica' ? u.critico : u.atencion;
    salida.push(senal('umbral', nv,
      `${def.titulo} ${cruce ? 'cruzó' : 'sigue sobre'} el umbral ${nv === 'critica' ? 'crítico' : 'de atención'}: ${r1(v)} ${def.unidad} (umbral ${limite})`,
      { valor: r1(v), umbral: limite, cruce: !!cruce, minutosSobreUmbral: Math.round((ultimo.t - desde) / MIN) }));
  }

  // 2. Fuera de lo normal (misma hora ±1 h, 7 días anteriores, sin las últimas 6 h)
  const horaDia = (t) => new Date(t - 5 * HORA).getUTCHours();    // hora de Colombia
  const hAhora = horaDia(ultimo.t);
  const historicos = pts.filter((p) => Number.isFinite(p.valor) && p.t < ultimo.t - 6 * HORA && p.t >= ultimo.t - 7 * 24 * HORA
    && Math.min(Math.abs(horaDia(p.t) - hAhora), 24 - Math.abs(horaDia(p.t) - hAhora)) <= 1).map((p) => p.valor);
  if (historicos.length >= MUESTRAS_NORMAL) {
    const p10 = percentil(historicos, 0.1);
    const p90 = percentil(historicos, 0.9);
    const rango = Math.max(p90 - p10, Math.abs(p90) * 0.1, 1);
    if (v > p90 + 0.5 * rango) {
      salida.push(senal('fuera_de_lo_normal', 'atencion', `${def.titulo} muy por encima de lo habitual a esta hora: ${r1(v)} ${def.unidad} (p90 ${r1(p90)})`,
        { valor: r1(v), p10: r1(p10), p90: r1(p90), muestras: historicos.length, direccion: 'arriba' }));
    } else if (v < p10 - 0.5 * rango) {
      salida.push(senal('fuera_de_lo_normal', 'info', `${def.titulo} muy por debajo de lo habitual a esta hora: ${r1(v)} ${def.unidad} (p10 ${r1(p10)})`,
        { valor: r1(v), p10: r1(p10), p90: r1(p90), muestras: historicos.length, direccion: 'abajo' }));
    }
  }

  // 3. Aceleración y 4. proyección (pendientes por hora)
  const ultimaHora = pts.filter((p) => p.t > ultimo.t - HORA - MIN);
  const previa = pts.filter((p) => p.t <= ultimo.t - HORA - MIN && p.t > ultimo.t - 3 * HORA - MIN);
  const mReciente = ultimaHora.length >= 3 ? pendienteHora(ultimaHora) : null;
  const mPrevia = previa.length >= 4 ? pendienteHora(previa) : null;
  if (mReciente !== null && mPrevia !== null) {
    const sube = u?.sentido === 'bajo' ? mReciente < 0 : mReciente > 0;
    const relevante = Math.abs(mReciente) >= Math.max(Math.abs(v) * 0.1, 1);
    if (sube && relevante && Math.abs(mReciente) >= 2 * Math.max(Math.abs(mPrevia), 0.0001)) {
      salida.push(senal('aceleracion', 'info', `${def.titulo} se aceleró: ${r1(mReciente)} ${def.unidad}/h en la última hora (antes ${r1(mPrevia)} ${def.unidad}/h)`,
        { valor: r1(v), pendienteHora: r1(mReciente), pendientePreviaHora: r1(mPrevia) }));
    }
  }
  if (u && nv !== 'critica' && mReciente !== null) {
    const falta = u.sentido === 'bajo' ? v - u.critico : u.critico - v;
    const avance = u.sentido === 'bajo' ? -mReciente : mReciente;
    if (falta > 0 && avance > 0) {
      const horas = falta / avance;
      if (horas <= PROYECCION_MAX_H) {
        salida.push(senal('proyeccion', horas <= 4 ? 'atencion' : 'info',
          `${def.titulo}: a este ritmo llega al umbral crítico (${u.critico} ${def.unidad}) en unas ${r1(horas)} h`,
          { valor: r1(v), umbral: u.critico, pendienteHora: r1(mReciente), horas: r1(horas) }));
      }
    }
  }
  return salida;
}

const ORDEN = { critica: 0, atencion: 1, info: 2 };

/**
 * Señales de todos los KPI con serie.
 * @param {Map<string, Array>|Object<string, Array>} series  codigoKpi → serie ascendente
 */
function evaluarSenales(series, ahora = new Date()) {
  const entradas = series instanceof Map ? [...series.entries()] : Object.entries(series || {});
  return entradas.flatMap(([codigo, serie]) => senalesKpi(codigo, serie, ahora))
    .sort((a, b) => ORDEN[a.severidad] - ORDEN[b.severidad] || a.codigoKpi.localeCompare(b.codigoKpi));
}

module.exports = { senalesKpi, evaluarSenales, percentil, pendienteHora };
