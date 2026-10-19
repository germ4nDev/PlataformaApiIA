/*
    Author: German Valencia
    Pattern: PORTTOS Núcleo puro (AD-16) - Conversión OpenStreetMap → capa de referencia
    Description: Convierte elementos crudos de la API de OpenStreetMap (map.json: nodos, vías, relaciones)
      en el GeoJSON de referencia que usan los editores espaciales (AD-17):
        area_portuaria · muelle · rompeolas · tanque (punto + radio_m) · edificacion_en_terminal
      Sin red, sin base, sin dependencias: se prueba con datos guardados.
      Datos © colaboradores de OpenStreetMap, licencia ODbL.
*/

const RADIO_TIERRA = 6371008.8;
const ETIQUETAS_CONSERVADAS = ['landuse', 'industrial', 'man_made', 'building', 'mooring', 'surface', 'height', 'building:levels', 'operator', 'content', 'substance'];
const NOMBRE_PORTUARIO = /puert|portuari|terminal|muelle|contene|dock|\bport\b|compas|contecar|\bspr|tc ?buen|patio|bodega|granel|carb[oó]n|coal/i;
const DIST_MUELLE_M = 100;   // un área industrial a esta distancia de un muelle o rompeolas se considera portuaria
const DIST_TANQUE_M = 300;   // tanques dentro o cerca de un área portuaria

const redondear = (n) => Math.round(n * 1e6) / 1e6;

// ── Geometría plana local (suficiente a escala de puerto) ────────────────────
function metrosEntre(a, b) {
  const k = Math.cos(((a[1] + b[1]) / 2) * Math.PI / 180);
  const dx = (a[0] - b[0]) * k, dy = a[1] - b[1];
  return Math.hypot(dx, dy) * Math.PI / 180 * RADIO_TIERRA;
}

function distPuntoSegmento(p, a, b) {
  const k = Math.cos(p[1] * Math.PI / 180);
  const ax = (a[0] - p[0]) * k, ay = a[1] - p[1], bx = (b[0] - p[0]) * k, by = b[1] - p[1];
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  let t = l2 ? -(ax * dx + ay * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(ax + t * dx, ay + t * dy) * Math.PI / 180 * RADIO_TIERRA;
}

function dentroDeAnillo(p, anillo) {
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i], [xj, yj] = anillo[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

/** Polígonos de una geometría como lista de [exterior, ...huecos]. */
function poligonosDe(g) {
  if (g.type === 'Polygon') return [g.coordinates];
  if (g.type === 'MultiPolygon') return g.coordinates;
  return [];
}

function dentroDe(p, g) {
  return poligonosDe(g).some(([ext, ...huecos]) => dentroDeAnillo(p, ext) && !huecos.some((h) => dentroDeAnillo(p, h)));
}

function verticesDe(g) {
  if (g.type === 'Point') return [g.coordinates];
  if (g.type === 'LineString') return g.coordinates;
  return poligonosDe(g).flatMap((p) => p.flat());
}

function segmentosDe(g) {
  const lineas = g.type === 'LineString' ? [g.coordinates] : poligonosDe(g).flat();
  const s = [];
  lineas.forEach((l) => { for (let i = 1; i < l.length; i++) s.push([l[i - 1], l[i]]); });
  return s;
}

function caja(g) {
  const v = verticesDe(g);
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  v.forEach(([x, y]) => { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); });
  return [a, b, c, d];
}

function cajasCerca(c1, c2, metros) {
  const m = metros / 111000;
  return !(c1[2] + m < c2[0] || c2[2] + m < c1[0] || c1[3] + m < c2[1] || c2[3] + m < c1[1]);
}

/** Distancia mínima en metros entre dos geometrías (0 si una toca o contiene a la otra). */
function distancia(g1, g2) {
  const v1 = verticesDe(g1), v2 = verticesDe(g2);
  if (v1.some((p) => dentroDe(p, g2)) || v2.some((p) => dentroDe(p, g1))) return 0;
  const s1 = segmentosDe(g1), s2 = segmentosDe(g2);
  let min = Infinity;
  v1.forEach((p) => s2.forEach(([a, b]) => { min = Math.min(min, distPuntoSegmento(p, a, b)); }));
  v2.forEach((p) => s1.forEach(([a, b]) => { min = Math.min(min, distPuntoSegmento(p, a, b)); }));
  if (!s1.length || !s2.length) v1.forEach((p) => v2.forEach((q) => { min = Math.min(min, metrosEntre(p, q)); }));
  return min;
}

function areaAnillo(r) {
  let s = 0;
  for (let i = 1; i < r.length; i++) s += r[i - 1][0] * r[i][1] - r[i][0] * r[i - 1][1];
  return Math.abs(s / 2);
}
const areaDe = (g) => poligonosDe(g).reduce((s, [ext, ...h]) => s + areaAnillo(ext) - h.reduce((x, r) => x + areaAnillo(r), 0), 0);

function centroVertices(g) {
  const v = g.type === 'Polygon' ? g.coordinates[0].slice(0, -1) : verticesDe(g);
  return [v.reduce((s, p) => s + p[0], 0) / v.length, v.reduce((s, p) => s + p[1], 0) / v.length];
}

// ── Lectura de map.json ──────────────────────────────────────────────────────

/** Une las respuestas de varias teselas (sin duplicados por tipo+id). */
function unirTeselas(respuestas) {
  const vistos = new Map();
  respuestas.forEach((r) => (r.elements || []).forEach((e) => vistos.set(`${e.type}/${e.id}`, e)));
  return [...vistos.values()];
}

/** Arma anillos cerrados uniendo vías por sus extremos. Devuelve null si algún anillo queda abierto. */
function armarAnillos(listas) {
  const pend = listas.map((l) => l.slice());
  const anillos = [];
  while (pend.length) {
    let actual = pend.shift();
    let cambio = true;
    while (!mismoPunto(actual[0], actual[actual.length - 1]) && cambio) {
      cambio = false;
      for (let i = 0; i < pend.length; i++) {
        const w = pend[i], fin = actual[actual.length - 1];
        if (mismoPunto(w[0], fin)) actual = actual.concat(w.slice(1));
        else if (mismoPunto(w[w.length - 1], fin)) actual = actual.concat(w.slice(0, -1).reverse());
        else if (mismoPunto(w[w.length - 1], actual[0])) actual = w.concat(actual.slice(1));
        else if (mismoPunto(w[0], actual[0])) actual = w.slice().reverse().concat(actual.slice(1));
        else continue;
        pend.splice(i, 1); cambio = true; break;
      }
    }
    if (!mismoPunto(actual[0], actual[actual.length - 1]) || actual.length < 4) return null;
    anillos.push(actual);
  }
  return anillos;
}
const mismoPunto = (a, b) => a[0] === b[0] && a[1] === b[1];

/** Geometrías GeoJSON de vías y relaciones multipolígono, con sus etiquetas. */
function geometrias(elementos) {
  const nodos = new Map(), vias = new Map(), salida = [];
  elementos.forEach((e) => { if (e.type === 'node') nodos.set(e.id, [redondear(e.lon), redondear(e.lat)]); });
  elementos.forEach((e) => {
    if (e.type !== 'way') return;
    const c = (e.nodes || []).map((n) => nodos.get(n));
    if (c.some((p) => !p)) return; // vía incompleta (cortada por la tesela)
    vias.set(e.id, c);
  });
  elementos.forEach((e) => {
    if (e.type === 'way' && vias.has(e.id) && e.tags) {
      const c = vias.get(e.id);
      const cerrada = c.length >= 4 && mismoPunto(c[0], c[c.length - 1]);
      const esLinea = !cerrada || (e.tags.man_made === 'pier' && e.tags.area !== 'yes' && !e.tags.building);
      salida.push({ osm_id: `way/${e.id}`, tags: e.tags,
        geometry: esLinea && !cerrada ? { type: 'LineString', coordinates: c } : { type: 'Polygon', coordinates: [c] } });
    }
    if (e.type === 'relation' && e.tags?.type === 'multipolygon') {
      const miembros = (e.members || []).filter((m) => m.type === 'way');
      if (miembros.some((m) => !vias.has(m.ref))) return; // relación incompleta
      const ext = armarAnillos(miembros.filter((m) => m.role !== 'inner').map((m) => vias.get(m.ref)));
      const int = armarAnillos(miembros.filter((m) => m.role === 'inner').map((m) => vias.get(m.ref))) || [];
      if (!ext || !ext.length) return;
      const polis = ext.map((r) => [r]);
      int.forEach((h) => { const p = polis.find(([r]) => dentroDeAnillo(h[0], r)); if (p) p.push(h); });
      salida.push({ osm_id: `relation/${e.id}`, tags: e.tags,
        geometry: polis.length === 1 ? { type: 'Polygon', coordinates: polis[0] } : { type: 'MultiPolygon', coordinates: polis } });
    }
  });
  return salida;
}

// ── Clasificación ────────────────────────────────────────────────────────────

function tipoBase(t) {
  if (t.man_made === 'storage_tank' || t.man_made === 'silo') return 'tanque';
  if (t.man_made === 'pier' || t.man_made === 'quay') return 'muelle';
  if (t.man_made === 'breakwater' || t.man_made === 'groyne') return 'rompeolas';
  if (t.landuse === 'port' || t.landuse === 'industrial' || t.industrial === 'port' || t.harbour === 'yes') return 'candidata_area';
  if (t.building) return 'edificacion';
  return null;
}

function propiedades(item, tipo, area) {
  const p = { osm_id: item.osm_id, tipo, nombre: item.tags.name || null, area };
  Object.keys(item.tags).forEach((k) => { if (ETIQUETAS_CONSERVADAS.includes(k)) p[k] = item.tags[k]; });
  return p;
}

/**
 * Convierte elementos crudos en el FeatureCollection de referencia.
 * @param {object[]} elementos  elements de una o varias respuestas map.json (usar unirTeselas)
 * @param {object} meta  { puerto, fuente } se copian a la cabecera
 */
function convertir(elementos, meta = {}) {
  const items = geometrias(elementos).map((it) => ({ ...it, base: tipoBase(it.tags) })).filter((it) => it.base);
  items.forEach((it) => { it.caja = caja(it.geometry); });
  const de = (b) => items.filter((it) => it.base === b);
  const muelles = de('muelle'), rompeolas = de('rompeolas'), candidatas = de('candidata_area');
  const marinas = muelles.concat(rompeolas);

  // 1) Áreas portuarias: etiqueta de puerto, nombre portuario o junto a un muelle / rompeolas
  const semillas = candidatas.filter((a) =>
    a.tags.landuse === 'port' || a.tags.industrial === 'port' || a.tags.harbour === 'yes' ||
    NOMBRE_PORTUARIO.test(a.tags.name || '') ||
    marinas.some((m) => cajasCerca(a.caja, m.caja, DIST_MUELLE_M) && distancia(a.geometry, m.geometry) <= DIST_MUELLE_M));
  // 2) Más las áreas que tocan o están dentro de una semilla y son más pequeñas que ella (sin encadenar)
  const areas = candidatas.filter((a) => semillas.includes(a) || semillas.some((s) =>
    s !== a && areaDe(a.geometry) < areaDe(s.geometry) && cajasCerca(a.caja, s.caja, 0) && distancia(a.geometry, s.geometry) === 0));

  // Terminal a la que pertenece un punto: el área más grande con nombre que lo contiene
  const ordenadas = areas.slice().sort((x, y) => areaDe(y.geometry) - areaDe(x.geometry));
  const areaQueContiene = (p) => {
    const cont = ordenadas.filter((a) => dentroDe(p, a.geometry));
    if (!cont.length) return undefined;
    const conNombre = cont.find((a) => a.tags.name && a.tags.description !== 'Bloque');
    return conNombre ? conNombre.tags.name : `area ${cont[cont.length - 1].osm_id.split('/')[1]}`;
  };

  const features = [];
  areas.forEach((a) => features.push({ type: 'Feature', properties: propiedades(a, 'area_portuaria', null), geometry: a.geometry }));
  muelles.forEach((m) => features.push({ type: 'Feature', properties: propiedades(m, 'muelle', null), geometry: m.geometry }));
  rompeolas.forEach((m) => features.push({ type: 'Feature', properties: propiedades(m, 'rompeolas', null), geometry: m.geometry }));

  de('tanque').forEach((t) => {
    if (t.geometry.type !== 'Polygon') return;
    const anillo = t.geometry.coordinates[0].slice(0, -1);
    const c = centroVertices(t.geometry);
    const k = Math.cos(c[1] * Math.PI / 180);
    const radio = anillo.reduce((s, p) => s + Math.hypot((p[0] - c[0]) * k, p[1] - c[1]) * Math.PI / 180 * RADIO_TIERRA, 0) / anillo.length;
    const punto = { type: 'Point', coordinates: [redondear(c[0]), redondear(c[1])] };
    const cerca = areas.some((a) => cajasCerca(t.caja, a.caja, DIST_TANQUE_M) && distancia(punto, a.geometry) <= DIST_TANQUE_M);
    if (!cerca) return;
    const p = propiedades(t, 'tanque', areaQueContiene(c) || null);
    p.radio_m = Math.round(radio * 10) / 10;
    p.geometria_original = 'circulo_simplificado';
    features.push({ type: 'Feature', properties: p, geometry: punto });
  });

  de('edificacion').forEach((b) => {
    if (b.geometry.type === 'LineString') return;
    const nombreArea = areaQueContiene(centroVertices(b.geometry));
    if (!nombreArea) return;
    features.push({ type: 'Feature', properties: propiedades(b, 'edificacion_en_terminal', nombreArea), geometry: b.geometry });
  });

  const orden = { area_portuaria: 0, muelle: 1, rompeolas: 2, tanque: 3, edificacion_en_terminal: 4 };
  const idNum = (f) => Number(f.properties.osm_id.split('/')[1]);
  features.sort((x, y) => orden[x.properties.tipo] - orden[y.properties.tipo] || idNum(x) - idNum(y));

  return {
    type: 'FeatureCollection',
    puerto: meta.puerto || null,
    fuente: meta.fuente || 'OpenStreetMap (ODbL) via api.openstreetmap.org',
    nota: 'Tanques simplificados a punto central + radio_m (círculos en OSM). Datos (c) colaboradores de OpenStreetMap, licencia ODbL.',
    features,
  };
}

/** Conteo por tipo, para el informe del script. */
function resumen(fc) {
  const r = { area_portuaria: 0, muelle: 0, rompeolas: 0, tanque: 0, edificacion_en_terminal: 0 };
  fc.features.forEach((f) => { r[f.properties.tipo] = (r[f.properties.tipo] || 0) + 1; });
  return r;
}

module.exports = { convertir, unirTeselas, resumen, armarAnillos, distancia, dentroDe };
