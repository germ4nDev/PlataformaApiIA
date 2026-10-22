/*
    Author: German Valencia
    Pattern: PORTTOS Núcleo puro (AD-16) - Simulador de la flota terrestre
    Description: Sin base de datos ni red; lo usan flota-terrestre.service.js y las pruebas.
      Cada camión avanza SOBRE su ruta (distancia en metros, no "un punto por ciclo"), con velocidad propia que
      depende del tramo (curvas, entrada a la ciudad del puerto), acelera y frena, para en los peajes, frena o se
      detiene ante eventos viales activos, hace cola en la portería, descarga y carga en el puerto, y regresa por
      el mismo camino (ida y vuelta, sin teletransporte).
    Estados que escribe (TCL_FlotaTerrestre.estado):
      EN_RUTA · DETENIDO (peaje o marcha muy lenta) · DETENIDO_POR_TRAFICO (evento vial) · EN_COLA (portería)
      DESCARGANDO · CARGANDO (terminal) · EN_PATIO (origen, entre viajes)
    Las fases con espera guardan 'hasta' (ms); el azar entra por rng() para poder probarlo con una semilla.
*/
const { metros } = require('./reglas-alertas');

const PARAMETROS = Object.freeze({
  // Tractocamión en los corredores de Colombia: 40 a 60 km/h en recta; promedio real ~35 km/h con curvas y pendientes
  velocidadMin: 40, velocidadMax: 60,      // km/h de crucero de cada camión (fija por placa)
  factorCargado: 0.85,                     // cargado va más despacio
  aceleracion: 1, frenado: 3,              // km/h por segundo
  // Curvas: suma del giro de la vía en los próximos 200 m (y 50 m atrás) → límite
  curvaAdelanteM: 200, curvaAtrasM: 50,
  curvas: [[90, 0.4], [45, 0.55], [20, 0.75]],   // [grados, factor]
  zonaUrbanaM: 4000, velocidadUrbana: 25,  // últimos metros antes del puerto
  toleranciaPeajeM: 400,                   // peaje a menos de esto de la ruta = el camión para ahí
  peajeSeg: [60, 180],
  toleranciaEventoM: 300,
  avisoEventoM: 1500,                      // empieza a frenar a esta distancia del evento
  paradaEventoM: 150,
  colaMin: [20, 90], factorPico: 1.6,      // portería; horas pico 6-9 y 16-19 (Colombia)
  descargueMin: [40, 90], cargueMin: [40, 90], probabilidadRetorno: 0.6,
  patioMin: [30, 120], separacionColaM: 18, separacionPatioM: 15,
  dispersionTerminalM: 60,                // dentro del puerto (patios de la terminal)
  saltoMaximoSeg: 60,                      // si el API estuvo detenido, no se recorre todo de golpe
});

// ── Geometría de la ruta ─────────────────────────────────────────────────────
const aRad = (g) => (g * Math.PI) / 180;

/** Rumbo (0 = norte, sentido horario) del tramo a→b. */
function rumbo(a, b) {
  const k = Math.cos(aRad((a[1] + b[1]) / 2));
  const g = (Math.atan2((b[0] - a[0]) * k, b[1] - a[1]) * 180) / Math.PI;
  return Math.round((g + 360) % 360);
}

const giro = (r1, r2) => Math.abs(((r2 - r1 + 540) % 360) - 180);

/** Proyección de un punto sobre la ruta: distancia desde el inicio (s) y separación en metros (d). */
function proyectar(ruta, p) {
  let mejor = { s: 0, d: Infinity };
  const k = Math.cos(aRad(p[1]));
  for (let i = 0; i < ruta.coords.length - 1; i++) {
    const a = ruta.coords[i], b = ruta.coords[i + 1];
    const ax = (a[0] - p[0]) * k, ay = a[1] - p[1], bx = (b[0] - p[0]) * k, by = b[1] - p[1];
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0;
    const d = metros(p, [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    if (d < mejor.d) mejor = { s: ruta.acum[i] + (ruta.acum[i + 1] - ruta.acum[i]) * t, d };
  }
  return mejor;
}

/**
 * Prepara una ruta del simulador.
 * @param {{id, puntos: Array<{paso, lon, lat}>}} r     waypoints de TCL_SimuladorWaypoints
 * @param {{peajes?, puertoEn?: (lon, lat) => string|null}} ctx  puertoEn dice si un extremo está en un puerto
 */
function prepararRuta(r, ctx = {}, opciones = {}) {
  const o = { ...PARAMETROS, ...opciones };
  const coords = [...r.puntos].sort((a, b) => a.paso - b.paso)
    .map((p) => [Number(p.lon), Number(p.lat)])
    .filter((c, i, arr) => Number.isFinite(c[0]) && Number.isFinite(c[1]) && (i === 0 || c[0] !== arr[i - 1][0] || c[1] !== arr[i - 1][1]));
  if (coords.length < 2) return null;
  const acum = [0];
  for (let i = 1; i < coords.length; i++) acum.push(acum[i - 1] + metros(coords[i - 1], coords[i]));
  const rumbos = coords.slice(0, -1).map((c, i) => rumbo(c, coords[i + 1]));
  // Giro de la vía en cada vértice (grados); el límite por curva se calcula con los vértices cercanos (factorCurva)
  const giros = coords.map((_, i) => (i > 0 && i < coords.length - 1 ? giro(rumbos[i - 1], rumbos[i]) : 0));
  const ruta = { id: r.id, coords, acum, largo: acum[acum.length - 1], rumbos, giros };
  ruta.puertoInicio = ctx.puertoEn ? ctx.puertoEn(...coords[0]) : null;
  ruta.puertoFin = ctx.puertoEn ? ctx.puertoEn(...coords[coords.length - 1]) : null;
  // Si ningún extremo cae en un puerto, el final de la ruta hace de puerto
  if (!ruta.puertoInicio && !ruta.puertoFin) ruta.puertoFin = 'DESTINO';
  ruta.peajes = (ctx.peajes || [])
    .map((p) => ({ nombre: p.nombre, ...proyectar(ruta, p.coordenadas) }))
    .filter((p) => p.d <= o.toleranciaPeajeM && p.s > 50 && p.s < ruta.largo - 50)
    .map((p) => ({ nombre: p.nombre, s: p.s }))
    .sort((a, b) => a.s - b.s);
  ruta.eventos = [];
  return ruta;
}

/** Eventos viales activos sobre la ruta (se recalcula cuando cambian los eventos). */
function eventosSobreRuta(ruta, eventos, opciones = {}) {
  const o = { ...PARAMETROS, ...opciones };
  return (eventos || []).flatMap((e) => {
    const p = [Number(e.lon), Number(e.lat)];
    if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])) return [];
    const { s, d } = proyectar(ruta, p);
    if (d > o.toleranciaEventoM) return [];
    const texto = `${e.tipoEvento || ''} ${e.nivelSeveridad || ''}`;
    // cierre / accidente / severidad alta → se detienen; congestión u obra → marcha lenta
    const limite = /cierre|accidente|alta|cr[ií]tic/i.test(texto) ? 0 : /congesti|tr[aá]fico|obra/i.test(texto) ? 15 : 30;
    return [{ s, limite, codigo: e.codigoEvento }];
  });
}

/** Punto, rumbo e índice del waypoint más cercano a la distancia s (sentido +1 ida, -1 regreso). */
function puntoEn(ruta, s, sentido = 1) {
  const x = Math.max(0, Math.min(ruta.largo, s));
  let lo = 0, hi = ruta.acum.length - 2;
  while (lo < hi) {
    const m = (lo + hi + 1) >> 1;
    if (ruta.acum[m] <= x) lo = m; else hi = m - 1;
  }
  const a = ruta.coords[lo], b = ruta.coords[lo + 1];
  const t = (x - ruta.acum[lo]) / ((ruta.acum[lo + 1] - ruta.acum[lo]) || 1);
  return {
    lon: a[0] + (b[0] - a[0]) * t,
    lat: a[1] + (b[1] - a[1]) * t,
    rumbo: sentido > 0 ? ruta.rumbos[lo] : (ruta.rumbos[lo] + 180) % 360,
    paso: (t < 0.5 ? lo : lo + 1) + 1,
    tramo: lo,
  };
}

// ── Azar reproducible por placa ──────────────────────────────────────────────
function hashPlaca(placa, sal = 0) {
  let h = 2166136261 ^ sal;
  for (const ch of String(placa)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return ((h >>> 0) % 100000) / 100000;
}
const entre = (rng, [a, b]) => a + (b - a) * rng();
const minutos = (rng, rango) => entre(rng, rango) * 60000;

/** Hora de Colombia (UTC-5, sin horario de verano). */
const horaColombia = (ms) => (new Date(ms).getUTCHours() + 19) % 24;
const esPico = (ms) => { const h = horaColombia(ms); return (h >= 6 && h < 9) || (h >= 16 && h < 19); };

// ── Camión ───────────────────────────────────────────────────────────────────
/** Estado inicial a partir de lo guardado (paso_actual) o, sin paso, en un punto al azar de la ruta. */
function crearCamion(placa, ruta, pasoActual, ahoraMs, rng = Math.random, opciones = {}) {
  const o = { ...PARAMETROS, ...opciones };
  const i = Number.isInteger(pasoActual) && pasoActual >= 1 ? Math.min(pasoActual - 1, ruta.acum.length - 1) : Math.floor(rng() * ruta.acum.length);
  const vBase = o.velocidadMin + (o.velocidadMax - o.velocidadMin) * hashPlaca(placa);
  return {
    placa, ruta: ruta.id, s: ruta.acum[i], sentido: hashPlaca(placa, 7) < 0.5 ? 1 : -1,
    fase: 'VIAJE', hasta: 0, v: vBase * 0.6, vBase, llegada: 0, motivo: null, cargado: true,
    // Al arrancar no se para en el peaje donde ya está
    peajeVisto: null, inicio: ahoraMs,
  };
}

/** Índice del último vértice con acum <= s. */
function indiceEn(ruta, s) {
  let lo = 0, hi = ruta.acum.length - 1;
  while (lo < hi) {
    const m = (lo + hi + 1) >> 1;
    if (ruta.acum[m] <= s) lo = m; else hi = m - 1;
  }
  return lo;
}

/** Factor de velocidad por curvas: suma de los giros de la vía entre 50 m atrás y 200 m adelante. */
function factorCurva(ruta, s, sentido, opciones = {}) {
  const o = { ...PARAMETROS, ...opciones };
  const i0 = indiceEn(ruta, s);
  let suma = 0;
  for (let i = i0 + 1; i < ruta.acum.length; i++) {           // hacia s creciente
    const d = ruta.acum[i] - s;
    if (d > (sentido > 0 ? o.curvaAdelanteM : o.curvaAtrasM)) break;
    suma += ruta.giros[i];
  }
  for (let i = i0; i >= 0; i--) {                              // hacia s decreciente
    const d = s - ruta.acum[i];
    if (d > (sentido > 0 ? o.curvaAtrasM : o.curvaAdelanteM)) break;
    suma += ruta.giros[i];
  }
  for (const [grados, factor] of o.curvas) if (suma >= grados) return factor;
  return 1;
}

/** ¿El extremo hacia el que va el camión es el puerto? */
const vaAlPuerto = (ruta, c) => (c.sentido > 0 ? ruta.puertoFin : ruta.puertoInicio) != null;

/** Límite de velocidad (km/h) en la posición s según el tramo, la entrada al puerto y los eventos de adelante. */
function limiteEn(ruta, c, o) {
  let limite = c.vBase * (c.cargado ? o.factorCargado : 1) * factorCurva(ruta, c.s, c.sentido, o);
  const restante = c.sentido > 0 ? ruta.largo - c.s : c.s;
  if (vaAlPuerto(ruta, c) && restante <= o.zonaUrbanaM) limite = Math.min(limite, o.velocidadUrbana);
  // ...y al salir del puerto también va despacio los primeros metros
  const recorrido = c.sentido > 0 ? c.s : ruta.largo - c.s;
  const salePuerto = (c.sentido > 0 ? ruta.puertoInicio : ruta.puertoFin) != null;
  if (salePuerto && recorrido <= o.zonaUrbanaM) limite = Math.min(limite, o.velocidadUrbana);
  let motivo = null;
  for (const e of ruta.eventos) {
    const adelante = (e.s - c.s) * c.sentido;
    if (adelante < -50 || adelante > o.avisoEventoM) continue;
    const l = e.limite === 0 ? (adelante <= o.paradaEventoM ? 0 : 20) : e.limite;
    if (l < limite) { limite = l; motivo = 'EVENTO'; }
  }
  return { limite, motivo };
}

/** Siguiente fase al terminar una espera. */
function terminarEspera(ruta, c, ahoraMs, rng, o) {
  if (c.fase === 'PEAJE') { c.fase = 'VIAJE'; return; }
  if (c.fase === 'COLA') { c.fase = 'DESCARGANDO'; c.hasta = ahoraMs + minutos(rng, o.descargueMin); return; }
  if (c.fase === 'DESCARGANDO' && rng() < o.probabilidadRetorno) { c.fase = 'CARGANDO'; c.hasta = ahoraMs + minutos(rng, o.cargueMin); return; }
  // DESCARGANDO sin carga de regreso (vacío), CARGANDO o PATIO (sale cargado) → viaje en sentido contrario
  c.cargado = c.fase !== 'DESCARGANDO';
  c.fase = 'VIAJE'; c.sentido = -c.sentido; c.v = 0; c.peajeVisto = null;
}

/** Llegada al extremo de la ruta: portería del puerto o patio de origen. */
function llegarAlExtremo(ruta, c, ahoraMs, rng, o) {
  c.s = c.sentido > 0 ? ruta.largo : 0;
  c.v = 0;
  c.llegada = ahoraMs;
  if (vaAlPuerto(ruta, c)) {
    c.fase = 'COLA';
    c.hasta = ahoraMs + minutos(rng, o.colaMin) * (esPico(ahoraMs) ? o.factorPico : 1);
  } else {
    c.fase = 'PATIO';
    const h = horaColombia(ahoraMs);
    // De noche (21:00 a 04:00) el camión duerme en el patio y sale en la madrugada
    const noche = h >= 21 || h < 4 ? (((24 + 5 - h) % 24) * 60 - new Date(ahoraMs).getUTCMinutes()) * 60000 : 0;
    c.hasta = ahoraMs + Math.max(noche, 0) + minutos(rng, o.patioMin);
  }
}

/**
 * Avanza un camión dtSeg segundos. Muta y devuelve el camión.
 * @returns el mismo camión, con c.fase / c.s / c.v / c.motivo actualizados
 */
function avanzar(ruta, c, dtSeg, ahoraMs, rng = Math.random, opciones = {}) {
  const o = { ...PARAMETROS, ...opciones };
  let dt = Math.max(0, Math.min(o.saltoMaximoSeg, dtSeg));
  if (c.fase !== 'VIAJE') {
    c.v = 0;
    if (ahoraMs < c.hasta) return c;
    terminarEspera(ruta, c, ahoraMs, rng, o);
    if (c.fase !== 'VIAJE') return c;
  }
  const { limite, motivo } = limiteEn(ruta, c, o);
  c.motivo = motivo;
  c.v = c.v < limite ? Math.min(limite, c.v + o.aceleracion * dt) : Math.max(limite, c.v - o.frenado * dt);
  const ds = (c.v / 3.6) * dt;
  const destino = c.s + ds * c.sentido;

  // Peaje entre la posición actual y la nueva (en el sentido de la marcha)
  const peaje = ruta.peajes.find((p) => p !== c.peajeVisto && (p.s - c.s) * c.sentido > 0 && (destino - p.s) * c.sentido >= 0);
  if (peaje) {
    c.s = peaje.s; c.v = 0; c.fase = 'PEAJE'; c.peajeVisto = peaje; c.motivo = 'PEAJE';
    c.hasta = ahoraMs + entre(rng, o.peajeSeg) * 1000;
    return c;
  }
  if (destino >= ruta.largo || destino <= 0) { llegarAlExtremo(ruta, c, ahoraMs, rng, o); return c; }
  c.s = destino;
  return c;
}

/** Estado para TCL_FlotaTerrestre. */
function estadoDe(c) {
  switch (c.fase) {
    case 'PEAJE': return 'DETENIDO';
    case 'COLA': return 'EN_COLA';
    case 'DESCARGANDO': return 'DESCARGANDO';
    case 'CARGANDO': return 'CARGANDO';
    case 'PATIO': return 'EN_PATIO';
    default:
      if (c.v >= 5) return 'EN_RUTA';
      return c.motivo === 'EVENTO' ? 'DETENIDO_POR_TRAFICO' : 'DETENIDO';
  }
}

/** Desplazamiento fijo por placa alrededor de un punto (terminal o patio), en metros. */
function dispersar(p, placa, radioM) {
  const ang = hashPlaca(placa, 11) * 2 * Math.PI, r = Math.sqrt(hashPlaca(placa, 13)) * radioM;
  const dLat = (r * Math.cos(ang)) / 111320, dLon = (r * Math.sin(ang)) / (111320 * Math.cos(aRad(p.lat)));
  return { ...p, lon: p.lon + dLon, lat: p.lat + dLat };
}

/**
 * Posición de cada camión para escribir. Todo lo que está fuera del puerto queda SOBRE la vía: los de la portería
 * forman una fila por orden de llegada y los del patio de origen se estacionan en fila sobre la vía de salida.
 * Solo los de la terminal se reparten alrededor del extremo (dentro del puerto; siempre el mismo lugar por placa).
 * @returns {Array<{placa, lon, lat, rumbo, velocidad, estado, paso}>}
 */
function posiciones(rutas, camiones, opciones = {}) {
  const o = { ...PARAMETROS, ...opciones };
  const filas = new Map();
  camiones.filter((c) => c.fase === 'COLA' || c.fase === 'PATIO')
    .sort((a, b) => a.llegada - b.llegada || String(a.placa).localeCompare(String(b.placa)))
    .forEach((c) => {
      const k = `${c.fase}|${c.ruta}|${c.s > 0 ? 'fin' : 'inicio'}`;
      filas.set(k, (filas.get(k) || 0) + 1);
      c.puesto = filas.get(k) - 1;
    });
  // Hacia adentro de la ruta desde el extremo donde está
  const adentro = (ruta, c) => (c.s >= ruta.largo / 2 ? -1 : 1);
  return camiones.flatMap((c) => {
    const ruta = rutas.get(c.ruta);
    if (!ruta) return [];
    let p;
    if (c.fase === 'COLA') p = puntoEn(ruta, c.s + adentro(ruta, c) * c.puesto * o.separacionColaM, c.sentido);
    else if (c.fase === 'PATIO') p = puntoEn(ruta, c.s + adentro(ruta, c) * c.puesto * o.separacionPatioM, -c.sentido);
    else if (c.fase === 'DESCARGANDO' || c.fase === 'CARGANDO') p = dispersar(puntoEn(ruta, c.s, c.sentido), c.placa, o.dispersionTerminalM);
    else p = puntoEn(ruta, c.s, c.sentido);
    return [{
      placa: c.placa, lon: Math.round(p.lon * 1e6) / 1e6, lat: Math.round(p.lat * 1e6) / 1e6,
      rumbo: p.rumbo, velocidad: c.fase === 'VIAJE' ? Math.round(c.v) : 0, estado: estadoDe(c), paso: p.paso,
    }];
  });
}

module.exports = {
  PARAMETROS, rumbo, proyectar, prepararRuta, factorCurva, eventosSobreRuta, puntoEn, hashPlaca, horaColombia, esPico,
  crearCamion, avanzar, estadoDe, posiciones,
};
