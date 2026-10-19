/*
    Author: German Valencia
    Controller: Virtual Gate - Citas y Operaciones Terrestres
*/
const citasGateService = require('../../services/torre-control/citas-gate.service');

const { responderError } = require('../../helpers/errores.helper');
const getCitasVirtualGate = async (req, res) => {
  try {
    // El controlador solo delega la tarea al servicio
    const dataGate = await citasGateService.obtenerDatosVirtualGate();

    // Y maneja la respuesta HTTP hacia Angular
    return res.status(200).json({
      ok: true,
      msg: 'Citas obtenidas correctamente',
      data: dataGate
    });

  } catch (error) {
    return responderError(res, error, 'citas-gate.getCitasVirtualGate');
  }
};

module.exports = {
  getCitasVirtualGate
};