/*
    Author: German Valencia
    Layer: HTTP Controller
    Module: Torre de Control - Virtual Gate (TCL_VIRTUAL_GATE_001)
*/
const virtualGateService = require('../../services/torre-control/virtual-gate.service');

class VirtualGateController {
  async obtenerResumenVirtualGate(req, res) {
    try {
      const puerto = (req.query.puerto || req.params.puerto || 'BUENAVENTURA')
        .toString()
        .trim()
        .toUpperCase();

      const data = await virtualGateService.obtenerDashboardVirtualGate(puerto);

      return res.status(200).json({
        ok: true,
        status: 200,
        puerto,
        data
      });
    } catch (error) {
      console.error('❌ [VirtualGateController] Error consultando Virtual Gate:', error);
      return res.status(500).json({
        ok: false,
        status: 500,
        mensaje: 'Error interno al consultar los datos de Virtual Gate.',
        detalle: error.message
      });
    }
  }
}

module.exports = new VirtualGateController();