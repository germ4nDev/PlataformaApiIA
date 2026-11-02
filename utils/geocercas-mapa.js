/*
    Author: German Valencia
    Pattern: PORTTOS Núcleo puro (AD-16) - Geocercas del mapa (OT-007, 2026-10-29)
    Description: Convierte las geocercas de los faros (TCL_MaestroFaros: wkt + radio_metros, con sus KPI) en GeoJSON para la app.
      Misma regla que la web (mapa-geometria.ts: hacerCircular / convertirWKT_ACirculo):
        - con radio_metros > 0 → círculo de ese radio alrededor del centroide;
        - un punto sin radio → círculo de 2 km;
        - un polígono sin radio → círculo del centroide hasta el borde sur de su caja (mín. 1 km).
      Sin red ni base: solo wellknown y turf.
        geocercasMovil(filas) → FeatureCollection de polígonos con { id, nombre, tipo, color, estadoKpi, camiones, naves }
*/
const turf = require('@turf/turf');
const { parse } = require('wellknown');

const MAX_GEOCERCAS = 150;
const PASOS_CIRCULO = 48;
const COLOR_DEFECTO = '#94a3b8';

const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const texto = (v, max = 80) => (v === null || v === undefined ? null : String(v).trim().slice(0, max) || null);
const redondear = (c) => (Array.isArray(c[0]) ? c.map(redondear) : [Math.round(c[0] * 1e5) / 1e5, Math.round(c[1] * 1e5) / 1e5]);
const colorValido = (c) => (/^#[0-9a-f]{3,8}$/i.test(String(c || '').trim()) ? String(c).trim() : COLOR_DEFECTO);

/** Geometría de la geocerca como la dibuja la web, o null si el WKT no sirve. */
function geometriaGeocerca(wkt, radioMetros) {
  let geom = null;
  try { geom = wkt ? parse(String(wkt)) : null; } catch { geom = null; }
  if (!geom || !geom.type) return null;
  try {
    const radio = num(radioMetros);
    if (radio && radio > 0) {
      return turf.circle(turf.centroid(geom).geometry.coordinates, radio / 1000, { steps: PASOS_CIRCULO, units: 'kilometers' }).geometry;
    }
    if (geom.type === 'Point') return turf.circle(geom.coordinates, 2, { steps: PASOS_CIRCULO, units: 'kilometers' }).geometry;
    const centro = turf.centroid(geom);
    const caja = turf.bbox(geom);
    let radioKm = turf.distance(centro, turf.point([centro.geometry.coordinates[0], caja[1]]), { units: 'kilometers' });
    if (!radioKm) radioKm = 1;
    return turf.circle(centro.geometry.coordinates, radioKm, { steps: PASOS_CIRCULO, units: 'kilometers' }).geometry;
  } catch {
    return null;
  }
}

function geocercasMovil(filas) {
  const features = (Array.isArray(filas) ? filas : []).map((g) => {
    const geometry = geometriaGeocerca(g?.wkt, g?.radio_metros);
    if (!geometry) return null;
    return {
      type: 'Feature',
      geometry: { type: geometry.type, coordinates: redondear(geometry.coordinates) },
      properties: {
        id: String(g.id_faro ?? g.nombre_faro ?? ''),
        nombre: texto(g.nombre_faro) || 'Geocerca',
        tipo: texto(g.tipo_faro, 40),
        color: colorValido(g.color_ui),
        estadoKpi: texto(g.estado_kpi, 12),
        camiones: num(g.total_camiones) ?? 0,
        naves: num(g.total_naves) ?? 0,
      },
    };
  }).filter(Boolean).slice(0, MAX_GEOCERCAS);
  return { type: 'FeatureCollection', features };
}

module.exports = { MAX_GEOCERCAS, COLOR_DEFECTO, geometriaGeocerca, geocercasMovil };
