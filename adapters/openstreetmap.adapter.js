/*
    Author: German Valencia
    Pattern: PORTTOS Adapter - OpenStreetMap (API 0.6)
    Description: Descarga los elementos crudos (nodos, vías, relaciones) de un rectángulo con /api/0.6/map.json.
      No escribe en la base ni en disco: devuelve la respuesta o lanza un error tipado.
      La API limita cada llamada (50.000 nodos y 0,25 grados²); cuando se excede responde 400 y
      lanzamos { codigo: 'DEMASIADOS_DATOS' } para que quien llama divida el rectángulo.
      Política de uso: User-Agent identificable y pocas peticiones seguidas
      (https://operations.osmfoundation.org/policies/api/). Datos © colaboradores de OpenStreetMap, ODbL.
*/
const axios = require('axios');

const URL = 'https://api.openstreetmap.org/api/0.6/map.json';
const http = axios.create({
  timeout: 120000,
  headers: { 'User-Agent': 'Porttos-Referencia/1.0 (capa de referencia portuaria)' },
  maxContentLength: 200 * 1024 * 1024,
});

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param {{minLon:number,minLat:number,maxLon:number,maxLat:number}} r
 * @returns {Promise<object>} respuesta map.json ({ elements: [...] })
 */
async function mapaPorRectangulo(r, intentos = 3) {
  const bbox = [r.minLon, r.minLat, r.maxLon, r.maxLat].map((n) => n.toFixed(6)).join(',');
  for (let i = 1; i <= intentos; i++) {
    try {
      const { data } = await http.get(URL, { params: { bbox } });
      return data;
    } catch (error) {
      const estado = error.response?.status;
      if (estado === 400 || estado === 509) {
        const e = new Error(`OpenStreetMap: rectángulo con demasiados datos (${bbox})`);
        e.codigo = 'DEMASIADOS_DATOS';
        throw e;
      }
      if (estado === 429 || estado >= 500 || !estado) {
        if (i < intentos) { await esperar(5000 * i); continue; }
      }
      const e = new Error(`OpenStreetMap: fallo al descargar ${bbox} (${estado || error.code || error.message})`);
      e.codigo = 'FALLO_RED';
      throw e;
    }
  }
  return null;
}

module.exports = { mapaPorRectangulo };
