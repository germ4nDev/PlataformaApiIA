/*
    Author: German Valencia
    Pattern: PORTTOS Standard - Controlador de Muelles
*/
const { response } = require('express');
const radarService = require('../../services/torre-control/radar.service');

const { responderError } = require('../../helpers/errores.helper');
class RadarController {

  async obtenerCapaRadar(req, res) {
    try {
      // 1. El controlador delega toda la lógica de obtención y formato al Servicio
      const geoJsonData = await radarService.generarGeoJSONRadar();

      // 2. Responde exitosamente a Angular
      res.status(200).json({
        success: true,
        data: geoJsonData
      });

    } catch (error) {
      return responderError(res, error, 'motonaves-radar.obtenerCapaRadar');
    }
  }

  // Aquí a futuro puedes agregar más métodos para el radar, por ejemplo:
  // async obtenerHistorialNave(req, res) { ... }
  // async obtenerEstadisticasTrafico(req, res) { ... }
}

module.exports = new RadarController();