const MapaPortuarioService = require('../../services/torre-control/mapa-portuario.service');

const { responderError } = require('../../helpers/errores.helper');
class MapaPortuarioController {

  async obtenerMapaFormatoFrontend(req, res) {
    try {
      const mapa = await MapaPortuarioService.obtenerMapaFormatoFrontend();

      return res.status(200).json({
        success: true,
        message: 'Mapa portuario cargado con éxito',
        data: mapa
      });

    } catch (error) {
      return responderError(res, error, 'mapa-portuario.obtenerMapaFormatoFrontend');
    }
  }
}

module.exports = new MapaPortuarioController();