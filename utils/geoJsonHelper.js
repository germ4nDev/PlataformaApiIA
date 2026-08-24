/*
    Author: German Valencia
    Utility: Transformador de geometrías puras a FeatureCollection de Mapbox
*/

/**
 * Envuelve una geometría plana (Point, Polygon, etc.) en un FeatureCollection.
 * Esto es necesario porque Mapbox Draw (en Angular) requiere esta estructura exacta.
 * 
 * @param {Object} geometryObject - Objeto geométrico puro (ej: { type: 'Point', coordinates: [...] })
 * @returns {Object|null} Objeto FeatureCollection o null si no hay geometría
 */
const wrapToFeatureCollection = (geometryObject) => {
  // Si no hay coordenadas en la base de datos, retornamos null para que el mapa no falle
  if (!geometryObject) {
    return null;
  }

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: geometryObject,
        properties: {} // Puedes enviar un ID o color aquí si Angular lo necesita después
      }
    ]
  };
};

// Exportamos la función destructurada para poder usarla con require
module.exports = {
  wrapToFeatureCollection
};