// const { Sequelize } = require('sequelize');
// const { sequelize } = require('../../database/connection');
// const { io } = require('../../index');
const motonavesRepository = require('../../repositories/torre-control/motonaves.repository');

class RadarService {

  async generarGeoJSONRadar() {
    // 1. Obtenemos los datos crudos desde la capa de acceso a datos (Repository)
    const navesData = await motonavesRepository.obtenerPosicionesConDimar();

    // 2. Lógica de negocio: Transformación de datos a GeoJSON
    const features = navesData
      // Filtramos coordenadas inválidas para proteger el mapa de Angular
      .filter(nave => nave.lat != null && nave.lon != null && nave.lat !== 0 && nave.lon !== 0)
      .map(nave => {
        return {
          type: "Feature",
          geometry: {
            type: "Point",
            // GeoJSON exige el orden [Longitud, Latitud]
            coordinates: [parseFloat(nave.lon), parseFloat(nave.lat)]
          },
          properties: {
            mmsi: nave.mmsi,
            nombre_motonave: nave.nombreMotonave || 'DESCONOCIDO',
            agencia: nave.agencia || "NO REGISTRADA",
            estado_nave: nave.estado_dimar || "TRANSITO / NO COMERCIAL",
            eta: nave.eta || null,
            id_aviso: nave.id_aviso || null,
            velocidad: parseFloat(nave.velocidad) || 0,
            rumbo: parseFloat(nave.rumbo) || 0,
            estado_inferido: nave.estadoInferido || "Desconocido",
            destino: nave.destino || "NO REPORTADO"
          }
        };
      });

    // 3. Retornamos el objeto procesado al controlador
    return {
      type: "FeatureCollection",
      features: features
    };
  }
}

module.exports = new RadarService();