/*
    Author: German Valencia
    Pattern: PORTTOS Controller - Endpoint de Layout
*/
const LayoutService = require('../../services/torre-control/layout.service');

const { responderError } = require('../../helpers/errores.helper');
const obtenerTablero = async (req, res) => {
  try {
    const { codigo_usuario } = req.params;

    if (!codigo_usuario) {
      return res.status(400).json({ success: false, message: 'Falta el código de usuario' });
    }

    const resultado = await LayoutService.obtenerTablero(codigo_usuario);
    return res.status(200).json(resultado);

  } catch (error) {
    return responderError(res, error, 'layout.obtenerTablero');
  }
};

const obtenerTableroUsuario = async (req, res) => {
  try {
    const usurio = req.params.codigo_usuario;
    const tablero = req.params.tablero
    // console.log('======== datos', usurio, tablero);   // [ruido de consola: comentado 2026-10-26]

    if (!usurio) {
      return res.status(400).json({ success: false, message: 'Falta el código de usuario' });
    }

    if (!tablero) {
      return res.status(400).json({ success: false, message: 'Falta el código del tablero' });
    }

    const resultado = await LayoutService.obtenerTableroUsuario(usurio, tablero);
    return res.status(200).json(resultado);

  } catch (error) {
    return responderError(res, error, 'layout.obtenerTableroUsuario');
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
    return responderError(res, error, 'layout.guardarTablero');
  }
};

module.exports = {
  obtenerTablero,
  obtenerTableroUsuario,
  guardarTablero
};