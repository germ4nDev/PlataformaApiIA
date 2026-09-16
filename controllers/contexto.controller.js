/* Author: German Valencia */
// Importamos el servicio en lugar del modelo
const SesionesService = require('../services/sesiones.service');
const sesionesService = new SesionesService();

const actualizarContextoSesion = async (req, res) => {
  try {
    // Extraemos el código de sesión y empaquetamos el resto como el DTO/Contexto
    const { codigoSesion, ...datosContexto } = req.body;

    if (!codigoSesion) {
      return res.status(400).json({
        ok: false,
        msg: 'El código de sesión es obligatorio'
      });
    }

    // 🟢 AGREGA ESTA LÍNEA PARA VER QUÉ LLEGA DESDE ANGULAR
    console.log(`🔎 [POST CONTEXTO] Buscando sesión: "${codigoSesion}"`);
    console.log(`🔎 [POST CONTEXTO] Datos a actualizar:`, datosContexto);

    if (!codigoSesion) {
      return res.status(400).json({ ok: false, msg: 'Falta el código de sesión' });
    }

    // 🟢 Delegamos TODA la responsabilidad de negocio y base de datos al servicio
    await sesionesService.actualizarContextoNavegacion(codigoSesion, datosContexto);

    // Retornamos éxito si el servicio no arrojó errores
    return res.status(200).json({
      ok: true,
      msg: 'Contexto de sesión actualizado correctamente'
    });

  } catch (error) {
    console.error('❌ [CONTROLLER] Error actualizando contexto vía POST:', error);
    return res.status(500).json({
      ok: false,
      msg: 'Error interno del servidor al actualizar el contexto'
    });
  }
};

module.exports = {
  actualizarContextoSesion
};