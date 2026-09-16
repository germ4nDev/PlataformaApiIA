// 1. Importas la conexión a la base de datos
const { sequelize } = require('../database/connection'); // Ajusta la ruta a tu carpeta database

// 2. Importas la función creadora del modelo
const { SesionModel } = require('../models/sesion'); // Ajusta la ruta a tu carpeta models

// 🟢 3. ¡LA CLAVE! Instancias el modelo pasándole la conexión
const PTLSesiones = SesionModel(sequelize);

const validarSesion = async (req, res, next) => {
  try {
    const codigoSesion = req.header('x-sesion-id');

    if (!codigoSesion) {
      return res.status(401).json({
        ok: false,
        msg: 'No hay identificador de sesión en la petición.'
      });
    }

    // 🟢 Ahora PTLSesiones ya no es undefined, ¡es el modelo real con la función findOne!
    const sesionDB = await PTLSesiones.findOne({
      where: { codigoSesion, activa: true }
    });

    if (!sesionDB) {
      return res.status(401).json({
        ok: false,
        msg: 'Sesión inactiva o reemplazada desde otro dispositivo.'
      });
    }

    req.sesionContexto = sesionDB;
    next();

  } catch (error) {
    console.error('❌ Error crítico en el middleware validarSesion:', error);
    return res.status(500).json({
      ok: false,
      msg: 'Error interno al validar el estado de la sesión.'
    });
  }
};

module.exports = {
  validarSesion
};