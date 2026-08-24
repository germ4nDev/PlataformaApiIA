const MapaPortuarioService = require('../../services/torre-control/mapa-portuario.service');

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
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor al cargar el mapa',
        error: error.message
      });
    }
  }
}

module.exports = new MapaPortuarioController();