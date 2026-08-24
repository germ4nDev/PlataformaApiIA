/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Security & Authentication Integrity
*/
const bcrypt = require("bcryptjs");
const { sequelize } = require('../database/connection');
const { generarJWT } = require("../helpers/jwt");
const { UsuarioModel } = require('../models/usuario');
const { io } = require('../index');

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

    // Notificación en tiempo real (Socket.io)
    io.emit('autenticaciones-actualizadas', {
      action: 'login',
      msg: `Sesión iniciada: ${usuarioDB.userNameUsuario}`
    });

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

  /**
   * Valida permisos basados en el RBAC del sistema
   */
  verificarRol(roles, roleToCheck) {
    if (!roles || !Array.isArray(roles)) return false;
    return roles.some((rol) => rol.nombre === roleToCheck);
  }
}

module.exports = AuthService;