/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Clean Error Handling, Auth Standards & Sesiones
*/
const { response } = require("express");
const AuthService = require("../services/auth.service");
const { getIO } = require('../helpers/socket.helper');
const service = new AuthService();

const login = async (req, res = response) => {
  try {
    const { username, password } = req.body;

    // 🟢 1. Extraemos TODO, incluyendo el codigoSesion, y enviamos la metadata
    const { usuario, token, codigoSesion } = await service.login(username, password, {
      dispositivo: req.headers['user-agent'],
      ip: req.ip
    });

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

    // 🟢 2. Devolvemos el codigoSesion en el JSON de respuesta
    return res.status(200).json({
      ok: true,
      token,
      usuario,
      codigoSesion // ¡El eslabón perdido!
    });
  } catch (error) {
    // 🟢 ¡ESTO ES LO QUE NECESITAMOS! Imprimimos el error real completo en la terminal de Node
    console.error("🔥 [ERROR CRÍTICO EN LOGIN DETALLADO]:", error);
    console.error("Stack trace:", error.stack);

    return res.status(error.statusCode || 500).json({
      ok: false,
      // 🟢 Opcional temporal: devuélvelo al frontend también para verlo en pantalla si gustas
      msg: error.msg || error.message || "Error de sistema. Hable con el administrador."
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

// 🟢 3. Añadimos el controlador de cerrarSesion
const cerrarSesion = async (req, res = response) => {
  try {
    const codigoUsuario = req.body.codigoUsuario || req.usuario?.codigoUsuario;
    const response = await service.cerrarSesion(codigoUsuario);

    return res.status(200).json(response);
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error de sistema al cerrar sesión."
    });
  }
};

module.exports = {
  login,
  renewToken,
  verificarClaveActual,
  verificarUserInRole,
  cerrarSesion // 🟢 Exportamos el método
};