/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Security & Authentication Integrity
*/
const bcrypt = require("bcryptjs");
const { sequelize } = require('../database/connection');
const { generarJWT } = require("../helpers/jwt");
const { UsuarioModel } = require('../models/usuario');
const { getIO } = require('../helpers/socket.helper');

class AuthService {
  constructor() {
    this.model = UsuarioModel(sequelize);
  }

  async login(username, password) {
    const usuarioDB = await this.model.findOne({
      where: { userNameUsuario: username }
    });
    console.log('usuarioDB', usuarioDB);

    if (!usuarioDB) throw { statusCode: 404, msg: "Usuario no encontrado." };
    if (!usuarioDB.estadoUsuario) throw { statusCode: 403, msg: "El usuario se encuentra inactivo." };

    const isMatch = await bcrypt.compare(password, usuarioDB.claveUsuario);
    if (!isMatch) throw { statusCode: 401, msg: "Credenciales no válidas." };

    // Generación de token
    const token = await generarJWT(
      usuarioDB.codigoUsuario,
      usuarioDB.userNameUsuario,
      usuarioDB.correoUsuario,
      usuarioDB.fotoUsuario
    );

    // 🟢 PROTECCIÓN DEL SOCKET (Evita el Error 500)
    try {
      const io = getIO();
      io.emit('autenticaciones-actualizadas', {
        action: 'login',
        msg: `Sesión iniciada: ${usuarioDB.userNameUsuario}`
      });
    } catch (errorSocket) {
      console.warn("⚠️ No se pudo emitir la notificación de login por socket:", errorSocket.message);
    }

    // Respuesta limpia (sin clave)
    return {
      usuario: {
        codigoUsuario: usuarioDB.codigoUsuario,
        nombreUsuario: usuarioDB.nombreUsuario,
        userNameUsuario: usuarioDB.userNameUsuario,
        correoUsuario: usuarioDB.correoUsuario,
        usuarioAdministrador: usuarioDB.usuarioAdministrador,
        fotoUsuario: usuarioDB.fotoUsuario
      },
      token
    };
  }

  async verificarClave(username, password) {
    // 1. Validar que el controlador sí esté enviando el password
    if (!password) throw { statusCode: 400, msg: "La contraseña es requerida para validar." };

    const usuarioDB = await this.model.findOne({
      where: { userNameUsuario: username },
      // 2. Forzar la carga de la clave en caso de que esté oculta globalmente en el modelo
      attributes: { include: ['claveUsuario'] }
    });

    if (!usuarioDB) throw { statusCode: 404, msg: "Usuario no encontrado." };

    // 3. Validar que el usuario en la BD realmente tenga un hash registrado
    if (!usuarioDB.claveUsuario) {
      console.error(`El usuario ${username} no tiene un hash de contraseña en la BD.`);
      throw { statusCode: 500, msg: "Error de integridad: El usuario no tiene clave registrada." };
    }

    // 4. Ejecutar bcrypt sabiendo que ambos parámetros son strings válidos
    const isMatch = await bcrypt.compare(password, usuarioDB.claveUsuario);

    if (!isMatch) throw { statusCode: 401, msg: "Contraseña incorrecta." };

    return usuarioDB;
  }

  async renovarToken(uid) {
    const usuarioDB = await this.model.findOne({
      where: { codigoUsuario: uid }
    });

    if (!usuarioDB) throw { statusCode: 404, msg: "Usuario no existe." };

    const token = await generarJWT(
      usuarioDB.codigoUsuario,
      usuarioDB.userNameUsuario,
      usuarioDB.fotoUsuario,
      usuarioDB.correoUsuario
    );

    // Retorno de usuario sin clave sensible
    return {
      usuario: {
        codigoUsuario: usuarioDB.codigoUsuario,
        nombreUsuario: usuarioDB.nombreUsuario,
        userNameUsuario: usuarioDB.userNameUsuario,
        correoUsuario: usuarioDB.correoUsuario,
        fotoUsuario: usuarioDB.fotoUsuario
      },
      token
    };
  }

  async cerrarSesion(req, res) {
    try {
      // Asumiendo que el middleware de autenticación te deja el codigoUsuario (o viene en el body/params)
      const codigoUsuario = req.body.codigoUsuario || req.usuario?.codigoUsuario;

      if (codigoUsuario) {
        // 1. Pasamos isOnline a false en la base de datos
        await PTLUsuarios.update(
          { isOnline: false },
          { where: { codigoUsuario } }
        );

        // 2. Emitimos el evento global para que todos los dashboards actualicen el contador
        // (Si tienes acceso a 'io' en este controlador)
        global.io.emit("usuariosActualizados");
      }

      return res.status(200).json({ success: true, message: "Sesión cerrada correctamente" });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Valida permisos basados en el RBAC del sistema
   */
  verificarRol(roles, roleToCheck) {
    if (!roles || !Array.isArray(roles)) return false;
    return roles.some((rol) => rol.nombre === roleToCheck);
  }

}

module.exports = AuthService;