/*
    Author: German Valencia
    Pattern: PORTTOS Núcleo puro (AD-16) - Ruteo sobre la red vial
    Description: Sin base de datos ni red; lo usan scripts/rutas-simulador.js y las pruebas.
      Ajusta una ruta del simulador (waypoints espaciados, que cortan curvas) a la geometría real de la vía:
      - construirGrafo(): tramos de la red vial (INVIAS/IGAC, MultiLineString) dentro de una caja → grafo.
        Cada tramo se simplifica (Douglas-Peucker, 3 m) y los extremos que quedan a menos de 20 m de otro
        tramo se unen (la red viene partida por tramos que no siempre comparten el vértice exacto).
      - puntosDePaso() / quitarEspuelas(): para ajustar con un ruteador externo (OSRM, la cartografía del fondo
        del mapa): puntos de paso cada ~10 km y limpieza de entradas y salidas por la misma calle.
      - ajustarRuta(): recorre los waypoints de a 'cada' puntos y entre cada par busca el camino más corto
        por la red (A*). Si no hay camino o el desvío es absurdo (> 2,5 veces la línea recta y > 2 km),
        ese tramo queda con los waypoints originales y se informa.
*/
const { metros } = require('./reglas-alertas');

const OPCIONES = Object.freeze({
  toleranciaSimplificarM: 3,
  toleranciaUnionM: 20,
  distanciaMaxEnganche: 1500,   // un waypoint a más de esto de la red no se ajusta
  cada: 8,                      // waypoints entre puntos de paso
  desvioMax: 2.5,
  desvioMinM: 2000,
});

// ── Simplificación ───────────────────────────────────────────────────────────
function distPuntoSegmento(p, a, b) {
  const k = Math.cos((p[1] * Math.PI) / 180);
  const ax = (a[0] - p[0]) * k, ay = a[1] - p[1], bx = (b[0] - p[0]) * k, by = b[1] - p[1];
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0;
  return Math.hypot(ax + t * dx, ay + t * dy) * 111320;
}

/** Douglas-Peucker iterativo (las líneas de la red tienen miles de vértices). */
function simplificar(coords, tolM) {
  if (coords.length <= 2) return coords;
  const guardar = new Uint8Array(coords.length);
  guardar[0] = 1; guardar[coords.length - 1] = 1;
  const pila = [[0, coords.length - 1]];
  while (pila.length) {
    const [i, j] = pila.pop();
    let max = -1, idx = -1;
    for (let k = i + 1; k < j; k++) {
      const d = distPuntoSegmento(coords[k], coords[i], coords[j]);
      if (d > max) { max = d; idx = k; }
    }
    if (max > tolM) { guardar[idx] = 1; pila.push([i, idx], [idx, j]); }
  }
  return coords.filter((_, i) => guardar[i]);
}

// ── Grafo ────────────────────────────────────────────────────────────────────
const enCaja = (c, caja) => c[0] >= caja.oeste && c[0] <= caja.este && c[1] >= caja.sur && c[1] <= caja.norte;
const CELDA = 0.002;   // ~220 m
const celda = (c) => `${Math.floor(c[0] / CELDA)}|${Math.floor(c[1] / CELDA)}`;

/**
 * @param {Array} features  GeoJSON (LineString o MultiLineString)
 * @param {{sur,oeste,norte,este}} caja  solo tramos con algún vértice adentro
 */
function construirGrafo(features, caja, opciones = {}) {
  const o = { ...OPCIONES, ...opciones };
  const nodos = [];            // [lon, lat]
  const ady = [];              // por nodo: [[vecino, metros], ...]
  const indice = new Map();    // clave exacta → id
  const rejilla = new Map();   // celda → [ids]
  const id = (c) => {
    const k = `${c[0].toFixed(6)},${c[1].toFixed(6)}`;
    let n = indice.get(k);
    if (n === undefined) {
      n = nodos.length; nodos.push([c[0], c[1]]); ady.push([]); indice.set(k, n);
      const ce = celda(c);
      if (!rejilla.has(ce)) rejilla.set(ce, []);
      rejilla.get(ce).push(n);
    }
    return n;
  };
  const unir = (a, b) => {
    if (a === b) return;
    const d = metros(nodos[a], nodos[b]);
    ady[a].push([b, d]); ady[b].push([a, d]);
  };
  const extremos = [];
  let tramos = 0;
  for (const f of features || []) {
    const g = f?.geometry;
    if (!g) continue;
    const lineas = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
    for (const linea of lineas) {
      if (!Array.isArray(linea) || linea.length < 2 || !linea.some((c) => enCaja(c, caja))) continue;
      const s = simplificar(linea, o.toleranciaSimplificarM);
      let previo = id(s[0]);
      for (let i = 1; i < s.length; i++) { const n = id(s[i]); unir(previo, n); previo = n; }
      extremos.push(id(s[0]), previo);
      tramos++;
    }
  }
  const grafo = { nodos, ady, rejilla, tramos };
  // Extremos sueltos: se unen al nodo más cercano de OTRO tramo a menos de toleranciaUnionM
  let uniones = 0;
  for (const e of extremos) {
    const cerca = nodoMasCercano(grafo, nodos[e], o.toleranciaUnionM, (n) => n !== e && !ady[e].some(([v]) => v === n));
    if (cerca) { unir(e, cerca.n); uniones++; }
  }
  grafo.uniones = uniones;
  return grafo;
}

/** Nodo más cercano a p dentro de radioM (opcionalmente con un filtro). */
function nodoMasCercano(grafo, p, radioM, filtro = null) {
  const pasos = Math.max(1, Math.ceil(radioM / 200));
  const cx = Math.floor(p[0] / CELDA), cy = Math.floor(p[1] / CELDA);
  let mejor = null;
  for (let dx = -pasos; dx <= pasos; dx++) {
    for (let dy = -pasos; dy <= pasos; dy++) {
      for (const n of grafo.rejilla.get(`${cx + dx}|${cy + dy}`) || []) {
        if (filtro && !filtro(n)) continue;
        const d = metros(p, grafo.nodos[n]);
        if (d <= radioM && (!mejor || d < mejor.d)) mejor = { n, d };
      }
    }
  }
  return mejor;
}

// ── A* ───────────────────────────────────────────────────────────────────────
class Monticulo {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(x) {
    const a = this.a; a.push(x);
    let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; }
  }
  pop() {
    const a = this.a, top = a[0], ult = a.pop();
    if (a.length) {
      a[0] = ult;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top;
  }
}

/** Camino más corto entre dos nodos. Devuelve { coords, largo } o null. */
function caminoMasCorto(grafo, desde, hasta, limiteM = Infinity) {
  if (desde === hasta) return { coords: [grafo.nodos[desde]], largo: 0 };
  const dist = new Map([[desde, 0]]);
  const previo = new Map();
  const meta = grafo.nodos[hasta];
  const h = new Monticulo();
  h.push([metros(grafo.nodos[desde], meta), desde]);
  const cerrado = new Set();
  while (h.size) {
    const [, n] = h.pop();
    if (n === hasta) break;
    if (cerrado.has(n)) continue;
    cerrado.add(n);
    const dn = dist.get(n);
    if (dn > limiteM) continue;
    for (const [v, w] of grafo.ady[n]) {
      const nd = dn + w;
      if (nd < (dist.get(v) ?? Infinity)) {
        dist.set(v, nd); previo.set(v, n);
        h.push([nd + metros(grafo.nodos[v], meta), v]);
      }
    }
  }
  if (!dist.has(hasta)) return null;
  const coords = [];
  for (let n = hasta; n !== undefined; n = previo.get(n)) coords.push(grafo.nodos[n]);
  return { coords: coords.reverse(), largo: dist.get(hasta) };
}

/**
 * Ajusta la ruta a la red. waypoints: [[lon, lat], ...] en orden.
 * @returns {{ coords, ajustados, sinAjuste: Array<{desde, hasta, motivo}>, largoOriginal, largoNuevo }}
 */
function ajustarRuta(grafo, waypoints, opciones = {}) {
  const o = { ...OPCIONES, ...opciones };
  const idx = [];
  for (let i = 0; i < waypoints.length; i += o.cada) idx.push(i);
  if (idx[idx.length - 1] !== waypoints.length - 1) idx.push(waypoints.length - 1);
  const enganche = idx.map((i) => nodoMasCercano(grafo, waypoints[i], o.distanciaMaxEnganche));
  const coords = [];
  const sinAjuste = [];
  let ajustados = 0;
  const agregar = (lista) => lista.forEach((c) => {
    const u = coords[coords.length - 1];
    if (!u || u[0] !== c[0] || u[1] !== c[1]) coords.push(c);
  });
  for (let k = 0; k < idx.length - 1; k++) {
    const a = enganche[k], b = enganche[k + 1];
    const originales = waypoints.slice(idx[k], idx[k + 1] + 1);
    let largoRecto = 0;
    for (let i = 1; i < originales.length; i++) largoRecto += metros(originales[i - 1], originales[i]);
    let motivo = null, camino = null;
    if (!a || !b) motivo = 'lejos de la red';
    else {
      camino = caminoMasCorto(grafo, a.n, b.n, Math.max(largoRecto * o.desvioMax, largoRecto + o.desvioMinM) * 1.2);
      if (!camino) motivo = 'sin conexión en la red';
      else if (camino.largo > largoRecto * o.desvioMax && camino.largo - largoRecto > o.desvioMinM) motivo = 'desvío excesivo';
    }
    if (motivo) {
      agregar(originales);
      sinAjuste.push({ desde: idx[k] + 1, hasta: idx[k + 1] + 1, motivo });
    } else {
      agregar(camino.coords);
      ajustados++;
    }
  }
  let largoOriginal = 0, largoNuevo = 0;
  for (let i = 1; i < waypoints.length; i++) largoOriginal += metros(waypoints[i - 1], waypoints[i]);
  for (let i = 1; i < coords.length; i++) largoNuevo += metros(coords[i - 1], coords[i]);
  return { coords, ajustados, sinAjuste, largoOriginal, largoNuevo };
}

/**
 * Puntos de paso para un ruteador externo (OSRM): el primero, el último y uno cada 'metrosEntre' de recorrido.
 * Si salen más de 'maximo', se espacian más. Devuelve [lon, lat].
 */
function puntosDePaso(coords, metrosEntre = 10000, maximo = 100) {
  let largo = 0;
  for (let i = 1; i < coords.length; i++) largo += metros(coords[i - 1], coords[i]);
  const paso = Math.max(metrosEntre, largo / (maximo - 1));
  const vias = [coords[0]];
  let acum = 0;
  for (let i = 1; i < coords.length - 1; i++) {
    acum += metros(coords[i - 1], coords[i]);
    if (acum >= paso) { vias.push(coords[i]); acum = 0; }
  }
  vias.push(coords[coords.length - 1]);
  return vias;
}

/**
 * Quita "espuelas": cuando un punto de paso cae al lado de la vía, el ruteador entra a una calle y se devuelve
 * por el mismo camino. Si el recorrido vuelve a menos de radioM de un punto ya visitado después de más de
 * minLazoM, se corta el lazo. También quita vértices repetidos.
 */
function quitarEspuelas(coords, radioM = 25, minLazoM = 150) {
  const salida = [];
  const acum = [];
  const rejilla = new Map();
  const ce = (c) => `${Math.floor(c[0] / 0.0005)}|${Math.floor(c[1] / 0.0005)}`;
  const quitarDesde = (k) => {
    for (let j = salida.length - 1; j >= k; j--) {
      const lista = rejilla.get(ce(salida[j]));
      if (lista) lista.splice(lista.indexOf(j), 1);
    }
    salida.length = k; acum.length = k;
  };
  for (const c of coords) {
    const u = salida[salida.length - 1];
    if (u && u[0] === c[0] && u[1] === c[1]) continue;
    const recorrido = u ? acum[acum.length - 1] + metros(u, c) : 0;
    // ¿Vuelve cerca de un punto anterior, después de un desvío largo?
    const [cx, cy] = ce(c).split('|').map(Number);
    let volver = -1;
    for (let dx = -1; dx <= 1 && volver < 0; dx++) {
      for (let dy = -1; dy <= 1 && volver < 0; dy++) {
        for (const j of rejilla.get(`${cx + dx}|${cy + dy}`) || []) {
          if (recorrido - acum[j] > minLazoM && metros(salida[j], c) <= radioM) { volver = j; break; }
        }
      }
    }
    if (volver >= 0) quitarDesde(volver + 1);
    const base = salida.length ? acum[acum.length - 1] + metros(salida[salida.length - 1], c) : 0;
    salida.push(c); acum.push(base);
    const k = ce(c);
    if (!rejilla.has(k)) rejilla.set(k, []);
    rejilla.get(k).push(salida.length - 1);
  }
  return salida;
}

const largoDe = (coords) => coords.reduce((t, c, i) => (i ? t + metros(coords[i - 1], c) : 0), 0);

/** Caja que contiene los waypoints, ampliada en grados. */
function cajaDe(puntos, margen = 0.05) {
  const lon = puntos.map((p) => p[0]), lat = puntos.map((p) => p[1]);
  return { oeste: Math.min(...lon) - margen, este: Math.max(...lon) + margen, sur: Math.min(...lat) - margen, norte: Math.max(...lat) + margen };
}

/** Rumbo de cada punto hacia el siguiente (el último repite el anterior). */
function rumbos(coords) {
  return coords.map((c, i) => {
    const a = i < coords.length - 1 ? c : coords[i - 1], b = i < coords.length - 1 ? coords[i + 1] : c;
    const k = Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180);
    return Math.round(((Math.atan2((b[0] - a[0]) * k, b[1] - a[1]) * 180) / Math.PI + 360) % 360);
  });
}

module.exports = { OPCIONES, simplificar, construirGrafo, nodoMasCercano, caminoMasCorto, ajustarRuta, puntosDePaso, quitarEspuelas, largoDe, cajaDe, rumbos };
