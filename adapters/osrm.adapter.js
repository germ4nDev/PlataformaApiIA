/*
    Author: German Valencia
    Pattern: PORTTOS Adapter - OSRM (ruteo sobre OpenStreetMap)
    Description: Pide a un servidor OSRM la ruta en carro que pasa por una lista de puntos y devuelve la geometría
      completa ([lon, lat]) y la distancia. Es la misma cartografía del fondo del mapa (OpenStreetMap), así que
      los camiones quedan exactamente sobre la vía que se ve. Uso puntual (scripts/rutas-simulador.js), no en línea.
      Servidor: OSRM_URL en el .env (por defecto el de demostración, https://router.project-osrm.org, que pide
      pocas peticiones y no es para producción). Datos © colaboradores de OpenStreetMap, ODbL.
      No escribe en la base ni en disco.
*/
const axios = require('axios');

const URL_BASE = (process.env.OSRM_URL || 'https://router.project-osrm.org').replace(/\/$/, '');
const MAX_PUNTOS = 100;
const http = axios.create({ timeout: 120000, headers: { 'User-Agent': 'Porttos-Simulador/1.0 (rutas de prueba)' } });
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param {Array<[number, number]>} puntos  [lon, lat] en orden (2 a 100)
 * @returns {Promise<{ coords: Array<[number, number]>, metros: number }>}
 */
async function rutaPorPuntos(puntos, intentos = 3) {
  if (!Array.isArray(puntos) || puntos.length < 2 || puntos.length > MAX_PUNTOS) {
    throw Object.assign(new Error(`OSRM: entre 2 y ${MAX_PUNTOS} puntos (llegaron ${puntos?.length})`), { codigo: 'PUNTOS_INVALIDOS' });
  }
  const lista = puntos.map((p) => `${Number(p[0]).toFixed(6)},${Number(p[1]).toFixed(6)}`).join(';');
  for (let i = 1; i <= intentos; i++) {
    try {
      const { data } = await http.get(`${URL_BASE}/route/v1/driving/${lista}`, {
        params: { overview: 'full', geometries: 'geojson', steps: false, continue_straight: true },
      });
      if (data?.code !== 'Ok' || !data.routes?.length) {
        throw Object.assign(new Error(`OSRM: ${data?.code || 'sin ruta'} ${data?.message || ''}`.trim()), { codigo: 'SIN_RUTA' });
      }
      return { coords: data.routes[0].geometry.coordinates, metros: data.routes[0].distance };
    } catch (error) {
      if (error.codigo) throw error;
      const estado = error.response?.status;
      if ((estado === 429 || estado >= 500 || !estado) && i < intentos) { await esperar(3000 * i); continue; }
      throw Object.assign(new Error(`OSRM no respondió (${estado || error.code || error.message})`), { codigo: 'OSRM_NO_DISPONIBLE' });
    }
  }
  return null;
}

module.exports = { rutaPorPuntos, MAX_PUNTOS };
