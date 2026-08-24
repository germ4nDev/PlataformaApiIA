const { TLCNaves_Avisadas } = require('../../models/torre-control/naves-avisadas.model');

exports.obtenerNavesPorPuerto = async (req, res) => {
  try {
    const { puerto } = req.query;

    if (!puerto) {
      return res.status(400).json({
        success: false,
        message: 'El parámetro puerto es obligatorio.'
      });
    }

    // Consultamos la BD filtrando por el puerto seleccionado y ordenando por fecha de llegada
    const naves = await TLCNaves_Avisadas.findAll({
      where: {
        capitania: puerto.trim().toUpperCase()
      },
      order: [
        ['eta', 'ASC'] // Ordenar desde el arribo más próximo al más lejano
      ],
      // Opcional: limitar a los próximos 50 arribos para no saturar la respuesta
      limit: 50
    });

    return res.status(200).json({
      success: true,
      data: naves
    });

  } catch (error) {
    // console.error('❌ Error al obtener naves avisadas:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al consultar naves avisadas.',
      error: error.message
    });
  }
};