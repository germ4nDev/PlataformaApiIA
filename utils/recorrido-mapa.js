/*
    Author: German Valencia
    Pattern: PORTTOS Núcleo puro (AD-16) - Recorrido del mapa (modo reproducir)
    Description: Sin base de datos ni red; lo usan recorrido-mapa.service.js y las pruebas.
      - filtrarCambios(): qué muestras guardar (solo lo que se movió, cambió de estado o lleva rato sin muestra).
      - armarRecorrido(): filas de TCL_RecorridoMapa → trayectorias compactas por objeto para el front.
      - lineaDeTiempo(): alertas del mapa y cambios de estado AIS → eventos ordenados de la línea de tiempo.
    Formato compacto del recorrido (el front interpola entre puntos):
      objetos: [{ tipo: 'NAVE'|'CAMION', id, nombre, p: [[segundo, lon, lat, rumbo|null, velocidad|null, iEstado]] }]
      segundo = segundos desde 'desde'; iEstado = posición en 'estados' (-1 sin estado).
*/
const { metros } = require('./reglas-alertas');

const TIPOS = Object.freeze(['NAVE', 'CAMION']);

/** Reglas del muestreo. silencioMaxMin también le dice al front cuándo un hueco significa "salió del radar". */
const MUESTREO = Object.freeze({
  metrosMin: 30,        // menos que esto es ruido de GPS
  silencioMaxMin: 10,   // aunque no se mueva, una muestra cada 10 min (así el front sabe que sigue ahí)
  olvidarMin: 120,      // objetos que no aparecen en 2 h salen de la memoria del muestreo
});

const clave = (m) => `${m.tipo}:${m.id}`;
const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const redondear = (v, d) => Math.round(v * 10 ** d) / 10 ** d;

/** Normaliza una posición leída de la base. Devuelve null si no sirve (sin id o sin coordenadas válidas). */
function muestraValida(m) {
  const lat = num(m?.latitud), lon = num(m?.longitud);
  if (!m || !TIPOS.includes(m.tipo) || !m.id || lat === null || lon === null) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180 || (lat === 0 && lon === 0)) return null;
  const rumbo = num(m.rumbo);
  return {
    tipo: m.tipo, id: String(m.id).trim().slice(0, 30), nombre: m.nombre ? String(m.nombre).trim().slice(0, 100) : null,
    latitud: lat, longitud: lon,
    rumbo: rumbo === null ? null : ((Math.round(rumbo) % 360) + 360) % 360,
    velocidad: num(m.velocidad), estado: m.estado ? String(m.estado).trim().slice(0, 30) : null,
  };
}

/**
 * Qué muestras guardar en este ciclo. Actualiza 'ultimas' (Map clave → { lon, lat, estado, ms }).
 * @returns {Array} muestras normalizadas que cambiaron, cada una con su fecha ISO
 */
function filtrarCambios(muestras, ultimas, ahoraMs = Date.now(), opciones = {}) {
  const o = { ...MUESTREO, ...opciones };
  const fecha = new Date(ahoraMs).toISOString();
  const guardar = [];
  const vistos = new Set();
  for (const cruda of muestras || []) {
    const m = muestraValida(cruda);
    if (!m) continue;
    const k = clave(m);
    if (vistos.has(k)) continue;      // la misma nave dos veces en el lote: vale la primera
    vistos.add(k);
    const previa = ultimas.get(k);
    const cambio = !previa
      || previa.estado !== m.estado
      || metros([previa.lon, previa.lat], [m.longitud, m.latitud]) >= o.metrosMin
      || ahoraMs - previa.ms >= o.silencioMaxMin * 60000;
    if (!cambio) continue;
    ultimas.set(k, { lon: m.longitud, lat: m.latitud, estado: m.estado, ms: ahoraMs });
    guardar.push({ ...m, fecha });
  }
  for (const [k, v] of ultimas) if (ahoraMs - v.ms > o.olvidarMin * 60000) ultimas.delete(k);
  return guardar;
}

/** Paso de submuestreo según la ventana: ~360 puntos por objeto como máximo, nunca menos de 60 s. */
const pasoPara = (horas) => Math.max(60, Math.round((horas * 3600) / 360 / 60) * 60);

/**
 * Filas de TCL_RecorridoMapa (cualquier orden) → recorrido compacto.
 * Se queda con un punto cada pasoSeg por objeto, más todo cambio de estado y el último punto.
 */
function armarRecorrido(filas, { desdeMs, hastaMs, pasoSeg = 60, puerto = null } = {}) {
  const estados = [];
  const iEstado = (e) => {
    if (!e) return -1;
    let i = estados.indexOf(e);
    if (i < 0) { estados.push(e); i = estados.length - 1; }
    return i;
  };
  const grupos = new Map();
  for (const f of filas || []) {
    const ms = Date.parse(f.fecha);
    const m = muestraValida({ ...f, id: f.id ?? f.id_objeto });
    if (!m || !Number.isFinite(ms) || ms < desdeMs || ms > hastaMs) continue;
    const k = clave(m);
    if (!grupos.has(k)) grupos.set(k, { tipo: m.tipo, id: m.id, nombre: m.nombre, filas: [] });
    const g = grupos.get(k);
    if (m.nombre) g.nombre = m.nombre;
    g.filas.push({ ...m, seg: Math.round((ms - desdeMs) / 1000) });
  }

  const objetos = [];
  let puntos = 0;
  for (const g of grupos.values()) {
    g.filas.sort((a, b) => a.seg - b.seg);
    const p = [];
    let ultimoSeg = -Infinity, ultimoEstado;
    g.filas.forEach((f, i) => {
      const esUltimo = i === g.filas.length - 1;
      if (f.seg - ultimoSeg < pasoSeg && f.estado === ultimoEstado && !esUltimo) return;
      if (p.length && p[p.length - 1][0] === f.seg) p.pop();
      p.push([f.seg, redondear(f.longitud, 5), redondear(f.latitud, 5), f.rumbo, f.velocidad === null ? null : redondear(f.velocidad, 1), iEstado(f.estado)]);
      ultimoSeg = f.seg; ultimoEstado = f.estado;
    });
    puntos += p.length;
    objetos.push({ tipo: g.tipo, id: g.id, nombre: g.nombre, p });
  }
  objetos.sort((a, b) => a.tipo.localeCompare(b.tipo) || String(a.nombre || a.id).localeCompare(String(b.nombre || b.id)));
  return {
    puerto,
    desde: new Date(desdeMs).toISOString(),
    hasta: new Date(hastaMs).toISOString(),
    duracionSeg: Math.round((hastaMs - desdeMs) / 1000),
    pasoSeg,
    // Un hueco más largo que esto entre dos puntos = el objeto salió del radar (no se interpola)
    huecoMaxSeg: Math.round(MUESTREO.silencioMaxMin * 60 * 2.5),
    estados,
    totales: { naves: objetos.filter((o) => o.tipo === 'NAVE').length, camiones: objetos.filter((o) => o.tipo === 'CAMION').length, puntos },
    objetos,
  };
}

/**
 * Eventos de la línea de tiempo: alertas del mapa (mismo formato del socket) y transiciones de estado AIS
 * (fila de TCL_EventosEstadoNave). Ordenados por segundo; fuera de la ventana se descartan.
 */
function lineaDeTiempo({ alertas = [], transiciones = [] } = {}, desdeMs, hastaMs) {
  const seg = (fecha) => {
    const ms = Date.parse(fecha);
    return Number.isFinite(ms) && ms >= desdeMs && ms <= hastaMs ? Math.round((ms - desdeMs) / 1000) : null;
  };
  const eventos = [];
  for (const a of alertas) {
    const s = seg(a.fecha);
    if (s === null) continue;
    eventos.push({
      seg: s, fuente: 'alerta', nivel: a.nivel || 'info', categoria: a.categoria || null,
      titulo: a.titulo || 'Alerta', mensaje: a.mensaje || '', coordenadas: a.coordenadas || null, entidad: a.entidad || null,
    });
  }
  for (const t of transiciones) {
    const s = seg(t.fecha);
    if (s === null) continue;
    const lon = num(t.longitud), lat = num(t.latitud);
    const nivel = /VARADO|SIN GOBIERNO|EMERGENCIA/.test(t.estadoNuevo || '') ? 'error' : 'info';
    eventos.push({
      seg: s, fuente: 'estado', nivel, categoria: 'estado_nave',
      titulo: `${t.nombre || t.mmsi}: ${t.estadoNuevo}`,
      mensaje: t.estadoAnterior ? `Antes ${t.estadoAnterior.toLowerCase()}` : '',
      coordenadas: lon !== null && lat !== null ? [lon, lat] : null, entidad: t.mmsi ? String(t.mmsi) : null,
    });
  }
  return eventos.sort((a, b) => a.seg - b.seg);
}

module.exports = { MUESTREO, TIPOS, muestraValida, filtrarCambios, pasoPara, armarRecorrido, lineaDeTiempo };
