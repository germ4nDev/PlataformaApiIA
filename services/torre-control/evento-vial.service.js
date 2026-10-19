/*
    Author: German Valencia
    Pattern: PORTTOS Service - Eventos viales
    Description: Incidentes viales activos como GeoJSON. Con ?puerto= se limitan al corredor del puerto
      (caja del puerto + margen terrestre). Acceso a datos en eventos-viales.repository.js.
*/
const EventosViales = require('../../repositories/torre-control/eventos-viales.repository');
const { cajaPuerto, MARGEN } = require('../../helpers/caja-puerto.helper');

class EventoVialService {
  /** @param {string} [puerto] filtro opcional: incidentes en el corredor del puerto */
  async obtenerEventosActivosGeoJSON(puerto) {
    const caja = await cajaPuerto(puerto, MARGEN.TERRESTRE);
    const eventos = await EventosViales.activos(caja);
    return {
      type: 'FeatureCollection',
      features: eventos
        .filter((e) => e.lon != null && e.lat != null)
        .map((e) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [e.lon, e.lat] },
          properties: {
            id: e.codigoEvento,
            corredor: e.corredorVial,
            sector: e.sector,
            tipoEvento: e.tipoEvento,
            descripcion: e.descripcion,
            nivelSeveridad: e.nivelSeveridad,
            fechaInicio: e.fechaInicio,
          },
        })),
    };
  }
}

module.exports = new EventoVialService();
