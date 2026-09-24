/*
    Author: German Valencia
    Controller: Virtual Gate - Citas y Operaciones Terrestres
*/
const citasGateService = require('../../services/torre-control/citas-gate.service');

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
    console.error('❌ Error en getCitasVirtualGate:', error);
    return res.status(500).json({
      ok: false,
      msg: 'Error interno obteniendo la cola del gate',
      error: error.message
    });
  }
};

module.exports = {
  getCitasVirtualGate
};