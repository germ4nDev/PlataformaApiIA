/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Clean Error Handling & Auth Standards
*/
const { response } = require("express");
const AuthService = require("../services/auth.service");
const { getIO } = require('../helpers/socket.helper');
const service = new AuthService();

const login = async (req, res = response) => {
  try {
    const { username, password } = req.body;
    const { usuario, token } = await service.login(username, password);

    try {
      const io = getIO();
      io.emit("actualizacion-datos-widget", {
        codigoWidget: 'WDG_PLAT_KPI_USUARIOS',
        payload: {
          evento: 'nuevo_login',
          ultimoUsuario: usuario.userNameUsuario,
          timestamp: new Date().toISOString()
        }
      });
    } catch (errorSocket) {
      console.warn("⚠️ Advertencia: No se pudo emitir la señal en tiempo real al tablero:", errorSocket.message);
    }

    return res.status(200).json({
      ok: true,
      token,
      usuario,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error de sistema. Hable con el administrador."
    });
  }
};

const verificarClaveActual = async (req, res = response) => {
  try {
    const { username, password } = req.body;
    const usuario = await service.verificarClave(username, password);

    return res.status(200).json({
      ok: true,
      usuario,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error de sistema. Hable con el administrador."
    });
  }
};

const renewToken = async (req, res = response) => {
  try {
    const uid = req.uid; // Asumiendo que viene de un middleware previo que valida el JWT
    const { usuario, token } = await service.renovarToken(uid);

    return res.status(200).json({
      ok: true,
      token,
      usuario
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error de sistema. Hable con el administrador."
    });
  }
};

const verificarUserInRole = async (req, res = response) => {
  try {
    const { role, usuario } = req.body;
    const isRole = service.verificarRol(usuario.roles, role);

    return res.status(200).json({
      ok: true,
      isRole,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error interno al verificar el rol."
    });
  }
};

module.exports = {
  login,
  renewToken,
  verificarClaveActual,
  verificarUserInRole,
};