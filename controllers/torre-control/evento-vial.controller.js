/*
    Author: German Valencia
    Pattern: PORTTOS Controller - Eventos viales
    Description: GET /api/eventos-viales/eventos?puerto= → GeoJSON de los vigentes (+ origen).
      PATCH /api/eventos-viales/eventos/:codigo/despejar → despeje manual del operador (motivo MANUAL).
*/
const EventoVialService = require('../../services/torre-control/evento-vial.service');
const { responderError } = require('../../helpers/errores.helper');

class EventoVialController {
  async getEventosActivos(req, res) {
    try {
      const geojsonData = await EventoVialService.obtenerEventosActivosGeoJSON(req.query.puerto);
      res.status(200).json(geojsonData);   // GeoJSON directo (el mapa lo pinta tal cual)
    } catch (error) {
      return responderError(res, error, 'evento-vial.getEventosActivos');
    }
  }

  async despejar(req, res) {
    try {
      const data = await EventoVialService.despejar(req.params, req.codigoUsuario || req.userNameUsuario || 'OPERADOR');
      res.status(200).json({ ok: true, data });
    } catch (error) {
      return responderError(res, error, 'evento-vial.despejar');
    }
  }
}

module.exports = new EventoVialController();
