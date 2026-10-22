/*
    Author: German Valencia
    Pattern: PORTTOS Helper - Caja geográfica del puerto para filtrar las capas del mapa
    Description: A partir de la geocerca del puerto (TCL_MaestroPuertos.geocerca_geo, la misma caja con la que
      se suscribe el radar AIS) devuelve { sur, oeste, norte, este } ampliada con un margen en grados.
      - Sin puerto, 'ALL' o un puerto sin geocerca → null (el endpoint responde como antes: todo el país).
      - Caché de 5 minutos: el mapa consulta la flota cada 10 s.
*/
const MaritimoRepository = require('../repositories/torre-control/maritimo.repository');
const { normalizarPuerto } = require('./salas.helper');

const CACHE_MS = 5 * 60 * 1000;
let cache = { hasta: 0, puertos: [] };

/** Márgenes por tipo de capa (grados; 1° ≈ 111 km). */
const MARGEN = Object.freeze({
  MARITIMO: 0.25,   // bahía, canal de acceso y zona de fondeo
  TERRESTRE: 1.5,   // corredor vial de acceso (p. ej. Buga–Buenaventura)
});

async function puertosConCaja() {
  if (Date.now() < cache.hasta) return cache.puertos;
  const filas = await MaritimoRepository.getPuertosParaMapa().catch(() => []);
  const puertos = (filas || []).map((p) => ({
    claves: [normalizarPuerto(p.id_puerto), normalizarPuerto(p.nombre)].filter(Boolean),
    sur: parseFloat(p.bbox_lat_sur), oeste: parseFloat(p.bbox_lon_oeste),
    norte: parseFloat(p.bbox_lat_norte), este: parseFloat(p.bbox_lon_este),
  })).filter((p) => [p.sur, p.oeste, p.norte, p.este].every(Number.isFinite) && p.sur < p.norte && p.oeste < p.este);
  cache = { hasta: Date.now() + CACHE_MS, puertos };
  return puertos;
}

/**
 * @param {string} puerto  id o nombre ("BUENAVENTURA", "Santa Marta")
 * @param {number} margen  grados a sumar por cada lado
 * @returns {Promise<{sur:number,oeste:number,norte:number,este:number}|null>}
 */
async function cajaPuerto(puerto, margen = MARGEN.MARITIMO) {
  const clave = normalizarPuerto(puerto || '');
  if (!clave || clave === 'ALL' || clave === 'TODOS') return null;
  const p = (await puertosConCaja()).find((x) => x.claves.includes(clave));
  if (!p) return null;
  const m = Number.isFinite(margen) ? margen : 0;
  return {
    sur: Math.max(-90, p.sur - m), oeste: Math.max(-180, p.oeste - m),
    norte: Math.min(90, p.norte + m), este: Math.min(180, p.este + m),
  };
}

/** Polígono WKT de la caja (para STIntersects con geometrías SRID 4326). Solo números: seguro para replacements. */
const cajaWkt = (c) =>
  `POLYGON((${c.oeste} ${c.sur}, ${c.este} ${c.sur}, ${c.este} ${c.norte}, ${c.oeste} ${c.norte}, ${c.oeste} ${c.sur}))`;

/** Puertos (clave normalizada) cuya caja, ampliada con el margen, contiene el punto. Para enrutar alertas por sala. */
async function puertosEnPunto(lon, lat, margen = MARGEN.TERRESTRE) {
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return [];
  return (await puertosConCaja())
    .filter((p) => lat >= p.sur - margen && lat <= p.norte + margen && lon >= p.oeste - margen && lon <= p.este + margen)
    .map((p) => p.claves[0]);
}

/** Puertos con caja configurada: [{ clave, centro: [lon, lat] }]. */
async function listarPuertos() {
  return (await puertosConCaja()).map((p) => ({ clave: p.claves[0], centro: [(p.oeste + p.este) / 2, (p.sur + p.norte) / 2] }));
}

const _reiniciarCache = () => { cache = { hasta: 0, puertos: [] }; };

module.exports = { cajaPuerto, cajaWkt, MARGEN, puertosEnPunto, listarPuertos, _reiniciarCache };
