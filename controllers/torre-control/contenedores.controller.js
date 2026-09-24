/*
    Author: German Valencia
    Pattern: PORTTOS Controller Pattern - Contenedores
*/
const { obtenerDatosContenedores } = require('../../services/torre-control/contenedores.service');
// Importa tu instancia global de sequelize configurada en el proyecto
// const { sequelize } = require('../../config/database'); 

const getDashboardContenedores = async (req, res) => {
  try {
    // Asumiendo que req.sequelize o tu instancia global está disponible
    const sequelizeInstance = req.sequelize || global.sequelize;

    const data = await obtenerDatosContenedores(sequelizeInstance);

    return res.status(200).json({
      success: true,
      msg: "Datos de contenedores obtenidos de BD correctamente",
      data: data
    });

  } catch (error) {
    console.error("❌ Error en getDashboardContenedores:", error);
    return res.status(500).json({
      success: false,
      msg: "Error interno al procesar el tablero de contenedores",
      error: error.message
    });
  }
};

module.exports = {
  getDashboardContenedores
};