// controllers/torre-control/evento-vial.controller.js
const EventoVialService = require('../../services/torre-control/evento-vial.service');

class EventoVialController {

  async getEventosActivos(req, res) {
    try {


      const geojsonData = await EventoVialService.obtenerEventosActivosGeoJSON();

      // Entregamos directamente el objeto GeoJSON
      res.status(200).json(geojsonData);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener la capa de incidentes viales',
        error: error.message
      });
    }
  }
}

module.exports = new EventoVialController();