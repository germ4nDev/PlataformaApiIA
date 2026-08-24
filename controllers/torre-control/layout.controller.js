/*
    Author: German Valencia
    Pattern: QPLUS Controller - Endpoint de Layout
*/
const LayoutService = require('../../services/torre-control/layout.service');

const obtenerTablero = async (req, res) => {
  try {
    const { codigo_usuario } = req.params;

    if (!codigo_usuario) {
      return res.status(400).json({ success: false, message: 'Falta el código de usuario' });
    }

    const resultado = await LayoutService.obtenerTablero(codigo_usuario);
    return res.status(200).json(resultado);

  } catch (error) {
    console.error("❌ [LAYOUT-CONTROLLER]:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const obtenerTableroUsuario = async (req, res) => {
  try {
    const usurio = req.params.codigo_usuario;
    const tablero = req.params.tablero
    console.log('======== datos', usurio, tablero);

    if (!usurio) {
      return res.status(400).json({ success: false, message: 'Falta el código de usuario' });
    }

    if (!tablero) {
      return res.status(400).json({ success: false, message: 'Falta el código del tablero' });
    }

    const resultado = await LayoutService.obtenerTableroUsuario(usurio, tablero);
    return res.status(200).json(resultado);

  } catch (error) {
    console.error("❌ [LAYOUT-CONTROLLER]:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const guardarTablero = async (req, res) => {
  try {
    // En producción 'codigo_usuario' debería salir del token JWT (ej. req.user.codigo)
    // Para esta etapa de desarrollo, lo recibiremos del body
    const { codigo_usuario, layout } = req.body;

    if (!codigo_usuario || !Array.isArray(layout) || layout.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Faltan parámetros o el arreglo del layout está vacío'
      });
    }

    const resultado = await LayoutService.guardarTablero(codigo_usuario, layout);

    return res.status(200).json(resultado);

  } catch (error) {
    // console.error("❌ [LAYOUT-CONTROLLER]:", error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  obtenerTablero,
  obtenerTableroUsuario,
  guardarTablero
};