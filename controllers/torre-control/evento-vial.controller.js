// controllers/torre-control/evento-vial.controller.js
const EventoVialService = require('../../services/torre-control/evento-vial.service');

const { responderError } = require('../../helpers/errores.helper');
class EventoVialController {

  async getEventosActivos(req, res) {
    try {


      const geojsonData = await EventoVialService.obtenerEventosActivosGeoJSON(req.query.puerto);

      // Entregamos directamente el objeto GeoJSON
      res.status(200).json(geojsonData);
    } catch (error) {
      return responderError(res, error, 'evento-vial.getEventosActivos');
    }
  }
}

module.exports = new EventoVialController();