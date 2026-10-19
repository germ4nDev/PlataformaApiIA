/*
    Author: German Valencia
    Pattern: PORTTOS Controller Pattern
*/
const KpisService = require('../../services/torre-control/kpis.service');

const { responderError } = require('../../helpers/errores.helper');
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
    return responderError(res, error, 'kpis.obtenerDashboard');
  }
};

module.exports = {
  obtenerDashboard
};