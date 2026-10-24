/*
    Author: German Valencia
    Layer: HTTP Controller
    Module: Torre de Control - Virtual Gate (TCL_VIRTUAL_GATE_001)
*/
const virtualGateService = require('../../services/torre-control/virtual-gate.service');

const { responderError } = require('../../helpers/errores.helper');
class VirtualGateController {
  async obtenerResumenVirtualGate(req, res) {
    try {
      const puerto = (req.query.puerto || req.params.puerto || 'BUENAVENTURA')
        .toString()
        .trim()
        .toUpperCase();

      // 1. Obtenemos toda la data del servicio
      const resultadoMapeado = await virtualGateService.obtenerDashboardVirtualGate(puerto);

      // 2. El servicio ya entrega el nodo virtualGate completo (resumen, citas, gráficas, paneles y origen)
      const virtualGate = resultadoMapeado.virtualGate || {};

      return res.status(200).json({
        ok: true,
        status: 200,
        msg: "Citas obtenidas correctamente",
        data: { generadoEn: resultadoMapeado.timestamp, virtualGate }
      });
    } catch (error) {
      return responderError(res, error, 'virtual-gate.obtenerResumenVirtualGate');
    }
  }
}

module.exports = new VirtualGateController();