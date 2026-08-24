// /*
//     Author: German Valencia
//     Service: TCL Config Service - Multi-Agent Orchestration
// */
// const { TclPuertoAgenteConfig, TclAgente, TclPuerto } = require('../../database/connection').models;

// class TclConfigService {

//   /**
//    * Obtiene todos los agentes activos y su configuración (prompts, endpoints)
//    * para un puerto específico.
//    * @param {string} codigoPuerto - Ej: 'BVENTURA'
//    */
//   async obtenerAgentesActivosPorPuerto(codigoPuerto) {
//     try {
//       const configuraciones = await TclPuertoAgenteConfig.findAll({
//         where: { estadoConfig: true },
//         include: [
//           {
//             model: TclPuerto,
//             as: 'puerto',
//             where: { codigoPuerto: codigoPuerto, estadoPuerto: true },
//             attributes: ['puertoId', 'nombrePuerto', 'timeZone']
//           },
//           {
//             model: TclAgente,
//             as: 'agente',
//             where: { estadoAgente: true },
//             attributes: ['codigoAgente', 'nombreAgente', 'systemPrompt']
//           }
//         ],
//         raw: true,
//         nest: true // Anida los resultados para facilitar la lectura
//       });

//       return configuraciones;
//     } catch (error) {
//       console.error("🔴 Error leyendo la configuración de agentes TCL:", error);
//       throw new Error("No se pudo cargar la configuración de la Torre de Control.");
//     }
//   }
// }

// module.exports = new TclConfigService();