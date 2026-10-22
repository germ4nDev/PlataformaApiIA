/*
    Author: German Valencia
    Pattern: PORTTOS Helper - Peajes nacionales (archivo estático data/Peajes_20260705.geojson)
    Description: Una sola lectura, en caché, para todo el API: el motor de alertas (peaje cruzado) y el simulador
      de flota (parada en el peaje) usan la misma lista. Formato de utils/reglas-alertas.js → peajesDesdeGeoJson:
      [{ nombre, coordenadas: [lon, lat] }].
*/
const fs = require('fs');
const path = require('path');
const { peajesDesdeGeoJson } = require('../utils/reglas-alertas');

const RUTA_PEAJES = path.join(__dirname, '../data/Peajes_20260705.geojson');
let cache = null;

function peajesNacionales() {
  if (!cache) {
    try {
      cache = peajesDesdeGeoJson(JSON.parse(fs.readFileSync(RUTA_PEAJES, 'utf8')));
    } catch (error) {
      console.error('[Peajes] No se pudo leer el archivo de peajes:', error.message);
      cache = [];
    }
  }
  return cache;
}

module.exports = { peajesNacionales, RUTA_PEAJES };
