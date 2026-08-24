const aisManager = require('../../services/torre-control/ais-redar-manager.service');

const cambiarFocoRadar = (req, res) => {
  try {

    const puertoId = req.params.id;
    console.log('&&&&&&&&&&&&&&&&  nuevo puerto', puertoId);

    if (!puertoId) {
      return res.status(400).json({
        success: false,
        error: 'El parámetro puertoId es obligatorio.'
      });
    }

    // Llamamos al servicio / manager para que ejecute la lógica de negocio
    aisManager.cambiarPuerto(puertoId);

    return res.status(200).json({
      success: true,
      message: `Radar reorientado correctamente al puerto: ${puertoId}`
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

module.exports = {
  cambiarFocoRadar
};