/*
    Author: German Valencia
    Pattern: QPLUS Controller - Matriz
*/
const TLCMatrizOperacionesService = require('../../services/torre-control/tlc-matriz-operaciones.service');

class TLCMatrizOperacionesController {

  async consultarMatriz(req, res) {
    try {
      const { terminal } = req.query;
      const datos = await TLCMatrizOperacionesService.obtenerMatriz(terminal);

      return res.status(200).json({
        success: true,
        message: 'Matriz de operaciones recuperada exitosamente.',
        data: datos
      });
    } catch (error) {
      // console.error('Error en TLCMatrizOperacionesController.consultarMatriz:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor al consultar la matriz.'
      });
    }
  }
}

module.exports = new TLCMatrizOperacionesController();