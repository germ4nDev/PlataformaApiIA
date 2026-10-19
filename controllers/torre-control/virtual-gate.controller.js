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

      // 2. Extraemos el resumen y las citas generadas por el servicio
      const resumen = resultadoMapeado.virtualGate?.resumen || resultadoMapeado.resumen || {};
      const citas = resultadoMapeado.virtualGate?.citas || resultadoMapeado.citas || resultadoMapeado.cola || [];
      const citas12h = resultadoMapeado.virtualGate?.citas12h || resultadoMapeado.citas12h || { labels: [], datasets: [] };
      const distribucion10km = resultadoMapeado.virtualGate?.distribucion10km || resultadoMapeado.distribucion10km || { labels: [], valores: [], items: [], total: 0 };
      const estadoCitas = resultadoMapeado.virtualGate?.estadoCitas || resultadoMapeado.estadoCitas || null;
      const validacion = resultadoMapeado.virtualGate?.validacion || resultadoMapeado.validacion || null;
      const alertas = resultadoMapeado.virtualGate?.alertas || resultadoMapeado.alertas || [];

      // 3. 🟢 FORZAMOS LA ESTRUCTURA EXACTA QUE ESPERA ANGULAR
      return res.status(200).json({
        ok: true,
        status: 200,
        msg: "Citas obtenidas correctamente",
        data: {
          virtualGate: {
            resumen: resumen,
            citas: citas,
            citas12h: citas12h,
            distribucion10km: distribucion10km,
            estadoCitas: estadoCitas,
            validacion: validacion,
            alertas: alertas
          }
        }
      });
    } catch (error) {
      return responderError(res, error, 'virtual-gate.obtenerResumenVirtualGate');
    }
  }
}

module.exports = new VirtualGateController();