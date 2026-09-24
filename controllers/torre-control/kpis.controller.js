/*
    Author: German Valencia
    Pattern: PORTTOS Controller Pattern
*/
const KpisService = require('../../services/torre-control/kpis.service');

// const obtenerDashboard = async (req, res) => {
//   try {
//     // 1. Capturamos el puerto que envía Angular (ej. 'BUENAVENTURA')
//     const puerto = req.query.puerto || req.body.puerto;

//     // 2. ORQUESTACIÓN LIMPIA: Ya no buscamos fechas aquí.
//     // El servicio se encarga de descubrir los meses y cruzar toda la data.
//     const resumenKpis = await KpisService.obtenerResumenOperativo(puerto);

//     // 3. Respuesta exitosa al Frontend
//     return res.status(200).json({
//       success: true,
//       ...resumenKpis
//     });

//   } catch (error) {
//     console.error('❌ [KPI-CONTROLLER] Error:', error.message);
//     return res.status(500).json({
//       success: false,
//       message: 'Error interno cargando los KPIs del dashboard',
//       error: error.message
//     });
//   }
// };

// const obtenerDashboard = async (req, res) => {
//   try {
//     const puerto = req.query.puerto || 'BUENAVENTURA';
//     const data = await KpisService.obtenerResumenOperativo(puerto);

//     // FORZAMOS una respuesta válida incluso si el servicio devuelve algo incompleto
//     return res.status(200).json({
//       success: true,
//       KPI_TERMINALES: data.KPI_TERMINALES || [],
//       FORECAST_MOTONAVES: data.FORECAST_MOTONAVES || { lista: [], grafico: { labels: [], dataEstimada: [], dataReal: [] } },
//       ...data
//     });
//   } catch (error) {
//     return res.status(500).json({ success: false, message: error.message });
//   }
// };

// const obtenerDashboard = async (req, res) => {
//   try {
//     const puerto = req.query.puerto || 'BUENAVENTURA';
//     const data = await KpisService.obtenerResumenOperativo(puerto);

//     // DEPURACIÓN: Esto nos dirá exactamente qué está saliendo del servicio
//     console.log("🔍 [DEBUG CONTROLADOR] Objeto devuelto por el servicio:", JSON.stringify(data, null, 2));

//     return res.status(200).json(data);
//   } catch (error) {
//     console.error("❌ [ERROR CONTROLADOR]:", error);
//     return res.status(500).json({ success: false, message: error.message });
//   }
// };

const obtenerDashboard = async (req, res) => {
  const { puerto } = req.query; // El puerto que viene desde el frontend

  try {
    // AQUÍ es donde llamas a la función
    const data = await KpisService.obtenerResumenOperativo(puerto);

    console.log("=== DATA ENVIADA AL FRONTEND ===");
    console.log(JSON.stringify(data.KPI_CAMIONES, null, 2));

    // console.log("🔍 [DEBUG CONTROLADOR] Objeto devuelto por el servicio:", JSON.stringify(data, null, 2));
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: "Error al cargar dashboard", error });
  }
};

module.exports = {
  obtenerDashboard
};