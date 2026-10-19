/*
    Author: German Dario Valencia Salazar
    Pattern: PORTTOS Controller Pattern - Flota Terrestre
*/
const FlotaTerrestreService = require('../../services/torre-control/flota-terrestre.service');
const { FlotaTerrestreDTOModel, FlotaTerrestreDTO } = require('../../models/torre-control/flota-terrestre.model');

const { responderError } = require('../../helpers/errores.helper');
class FlotaTerrestreController {

  // GET: Endpoint consumido por Angular (MapaGeneralService)
  async getFlotaActiva(req, res) {
    try {
      const geojson = await FlotaTerrestreService.obtenerFlotaGeoJSON(req.query.puerto);
      return res.status(200).json(geojson);
    } catch (error) {
      return responderError(res, error, 'flota-terrestre.getFlotaActiva');
    }
  }

  async obtenerGeocercasKPIs(req, res) {
    try {
      // Llamamos al servicio que ya habíamos dejado listo
      const data = await FlotaTerrestreService.obtenerCapaGeocercas(req.query.puerto);

      // Devolvemos el array dentro de la propiedad "data" que espera Angular
      return res.status(200).json({
        success: true,
        data: data
      });
    } catch (error) {
      return responderError(res, error, 'flota-terrestre.obtenerGeocercasKPIs');
    }
  }

  // POST: Webhook para recibir el GPS de las transportadoras
  async recibirPingGPS(req, res) {
    try {
      // Usamos el DTO que procesa y valida los datos antes de inyectarlos
      const dtoData = FlotaTerrestreDTO(req.body);
      await FlotaTerrestreService.upsertPosicion(dtoData);
      return res.status(200).json({ success: true, message: 'Posición actualizada' });
    } catch (error) {
      return responderError(res, error, 'flota-terrestre.recibirPingGPS');
    }
  }

  // GET: Disparador manual del simulador (O para ser llamado por el CronJob)
  async ejecutarSimulador(req, res) {
    try {
      const resultado = await FlotaTerrestreService.simularMovimientoFlota();
      return res.status(200).json(resultado);
    } catch (error) {
      return responderError(res, error, 'flota-terrestre.ejecutarSimulador');
    }
  }
}

module.exports = new FlotaTerrestreController();