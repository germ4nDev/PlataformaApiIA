/*
    Author: German Valencia
    Pattern: PORTTOS Helper - Lectura de WKT
    Description: Convierte el texto WKT que devuelve SQL Server (STAsText) en geometría GeoJSON.
      Usa wellknown: soporta POINT, POLYGON con huecos y MULTIPOLYGON. Un WKT inválido devuelve null.
*/
const wellknown = require('wellknown');

function wktAGeoJson(texto) {
  if (!texto || typeof texto !== 'string') return null;
  try {
    return wellknown.parse(texto) || null;
  } catch {
    return null;
  }
}

module.exports = { wktAGeoJson };
