// /*
//     Author: German Valencia
//     Layer: HTTP Controller
//     Module: Torre de Control - Virtual Gate (TCL_VIRTUAL_GATE_001)
// */
// const virtualGateService = require('../../services/torre-control/virtual-gate.service');

// class VirtualGateController {
//   async obtenerResumenVirtualGate(req, res) {
//     try {
//       const puerto = (req.query.puerto || req.params.puerto || 'BUENAVENTURA')
//         .toString()
//         .trim()
//         .toUpperCase();

//       // Aquí ejecutamos el servicio que devuelve el objeto con "virtualGate"
//       const resultadoMapeado = await virtualGateService.obtenerDashboardVirtualGate(puerto);

//       // Devolvemos el resultado COMPLETO y directo (resultadoMapeado ya trae puerto, timestamp y virtualGate)
//       return res.status(200).json({
//         ok: true,
//         status: 200,
//         msg: "Citas obtenidas correctamente",
//         data: resultadoMapeado.virtualGate || resultadoMapeado // Forzamos a que data contenga la estructura limpia
//       });
//     } catch (error) {
//       console.error('❌ [VirtualGateController] Error consultando Virtual Gate:', error);
//       return res.status(500).json({
//         ok: false,
//         status: 500,
//         mensaje: 'Error interno al consultar los datos de Virtual Gate.',
//         detalle: error.message
//       });
//     }
//   }
// }

// module.exports = new VirtualGateController();
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