/*
    Author: German Valencia
    Pattern: PORTTOS Núcleo puro (AD-16) - Zonas de consulta de eventos viales por puerto (OT-009, 2026-10-29)
    Description: Sin base de datos ni red. Las zonas fijas de TomTom (adapters/fuentes-externas.adapter.js) cubren los grandes
      corredores, pero no los accesos de todos los puertos del maestro: sin zona, el puerto no tenía eventos y el widget
      «Estado de los corredores» salía vacío. Aquí se agrega una zona de acceso por cada puerto activo cuyo punto no cae en
      ninguna zona existente, armada con su ubicación (nada fijo a un puerto):
        - caja de ±RADIO_GRADOS alrededor del puerto, siempre por debajo del límite de 10.000 km² de TomTom;
        - nombre 'Accesos <puerto>' (zonaFuente, máx. 40 caracteres) y corredor 'Accesos a <puerto>'.
*/
const RADIO_GRADOS = 0.35;
const LIMITE_KM2 = 10000;
const KM_POR_GRADO = 111.32;

const r2 = (n) => Math.round(n * 100) / 100;

/** Área aproximada (km²) de una caja 'oeste,sur,este,norte'. */
function areaKm2(bbox) {
  const [o, s, e, n] = String(bbox).split(',').map(Number);
  const latMedia = ((s + n) / 2) * Math.PI / 180;
  return Math.abs(n - s) * KM_POR_GRADO * Math.abs(e - o) * KM_POR_GRADO * Math.cos(latMedia);
}

function dentro(bbox, lat, lon) {
  const [o, s, e, n] = String(bbox).split(',').map(Number);
  return lat >= s && lat <= n && lon >= o && lon <= e;
}

/**
 * @param {{ nombre: string, lat: number, lon: number }[]} puertos  activos del maestro
 * @param {{ nombre: string, bbox: string, corredor: string }[]} zonasBase  las fijas del adaptador
 * @returns {{ nombre, bbox, corredor }[]} solo las zonas que hay que agregar
 */
function zonasDePuertos(puertos = [], zonasBase = []) {
  const extra = [];
  for (const p of puertos) {
    if (p.lat === null || p.lat === undefined || p.lon === null || p.lon === undefined || !p.nombre) continue;
    const lat = Number(p.lat);
    const lon = Number(p.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if ([...zonasBase, ...extra].some((z) => dentro(z.bbox, lat, lon))) continue;
    const bbox = [lon - RADIO_GRADOS, lat - RADIO_GRADOS, lon + RADIO_GRADOS, lat + RADIO_GRADOS].map(r2).join(',');
    if (areaKm2(bbox) >= LIMITE_KM2) continue;
    extra.push({ nombre: `Accesos ${p.nombre}`.slice(0, 40), bbox, corredor: `Accesos a ${p.nombre}` });
  }
  return extra;
}

module.exports = { RADIO_GRADOS, LIMITE_KM2, areaKm2, zonasDePuertos };
