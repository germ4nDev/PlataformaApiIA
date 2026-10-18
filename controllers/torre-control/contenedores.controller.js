/*
    Author: German Valencia
    Pattern: PORTTOS Controller Pattern - Contenedores
*/
const { obtenerDatosContenedores } = require('../../services/torre-control/contenedores.service');
const { responderError } = require('../../helpers/errores.helper');
// Importa tu instancia global de sequelize configurada en el proyecto
// const { sequelize } = require('../../config/database'); 

const getDashboardContenedores = async (req, res) => {
  try {
    // Corregido 2026-10-17: antes se pasaba una instancia de sequelize (que el servicio ignoraba) y nunca el puerto
    const puerto = req.query.puerto || req.params.puerto || 'BUENAVENTURA';
    const data = await obtenerDatosContenedores(puerto);

    return res.status(200).json({
      success: true,
      msg: "Datos de contenedores obtenidos de BD correctamente",
      data: data
    });

  } catch (error) {
    return responderError(res, error, 'ContenedoresController.getDashboardContenedores');
  }
};

module.exports = {
  getDashboardContenedores
};