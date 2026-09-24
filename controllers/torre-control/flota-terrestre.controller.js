/*
    Author: German Dario Valencia Salazar
    Pattern: PORTTOS Controller Pattern - Flota Terrestre
*/
const FlotaTerrestreService = require('../../services/torre-control/flota-terrestre.service');
const { FlotaTerrestreDTOModel, FlotaTerrestreDTO } = require('../../models/torre-control/flota-terrestre.model');

class FlotaTerrestreController {

  // GET: Endpoint consumido por Angular (MapaGeneralService)
  async getFlotaActiva(req, res) {
    try {
      const geojson = await FlotaTerrestreService.obtenerFlotaGeoJSON();
      return res.status(200).json(geojson);
    } catch (error) {
      console.error('Error en getFlotaActiva:', error);
      return res.status(500).json({ success: false, message: 'Error obteniendo flota terrestre.' });
    }
  }

  async obtenerGeocercasKPIs(req, res) {
    try {
      // Llamamos al servicio que ya habíamos dejado listo
      const data = await FlotaTerrestreService.obtenerCapaGeocercas();

      // Devolvemos el array dentro de la propiedad "data" que espera Angular
      return res.status(200).json({
        success: true,
        data: data
      });
    } catch (error) {
      console.error('❌ Error en controlador obtenerGeocercasKPIs:', error);
      return res.status(500).json({
        success: false,
        message: 'Error al obtener los KPIs de las geocercas'
      });
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
      if (error.type === 'ValidationError') return res.status(400).json({ success: false, errors: error.details });
      console.error('Error en recibirPingGPS:', error);
      return res.status(500).json({ success: false, message: 'Error interno.' });
    }
  }

  // GET: Disparador manual del simulador (O para ser llamado por el CronJob)
  async ejecutarSimulador(req, res) {
    try {
      const resultado = await FlotaTerrestreService.simularMovimientoFlota();
      return res.status(200).json(resultado);
    } catch (error) {
      console.error('Error en ejecutarSimulador:', error);
      return res.status(500).json({ success: false, message: 'Fallo en la simulación del motor vectorial.' });
    }
  }
}

module.exports = new FlotaTerrestreController();