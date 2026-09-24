/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Security & Authentication Integrity
*/
const bcrypt = require("bcryptjs");
const { sequelize } = require('../database/connection');
const { generarJWT } = require("../helpers/jwt");
const { UsuarioModel } = require('../models/usuario');
const { getIO } = require('../helpers/socket.helper');

const SesionesService = require('./sesiones.service');

class AuthService {
  constructor() {
    this.model = UsuarioModel(sequelize);
    this.sesionesService = new SesionesService(); // 🟢 Instanciamos el servicio
  }

  async login(username, password, metadata = {}) {
    const usuarioDB = await this.model.findOne({
      where: { userNameUsuario: username }
    });

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

    // 🟢 2. REGISTRAMOS LA SESIÓN EN LA BASE DE DATOS
    const nuevaSesion = await this.sesionesService.registrarSesion({
      codigoUsuario: usuarioDB.codigoUsuario,
      nombreUsuario: usuarioDB.nombreUsuario, // <-- ¡AQUÍ ESTABA EL FALTANTE!
      correoUsuario: usuarioDB.correoUsuario, // <-- Por si tu DTO también lo exige
      dispositivo: metadata.dispositivo || 'Web',
      ip: metadata.ip || '0.0.0.0'
    });

    try {
      const io = getIO();
      io.emit('autenticaciones-actualizadas', {
        action: 'login',
        msg: `Sesión iniciada: ${usuarioDB.userNameUsuario}`
      });
    } catch (errorSocket) {
      console.warn("⚠️ No se pudo emitir la notificación de login por socket:", errorSocket.message);
    }

    return {
      usuario: {
        codigoUsuario: usuarioDB.codigoUsuario,
        nombreUsuario: usuarioDB.nombreUsuario,
        userNameUsuario: usuarioDB.userNameUsuario,
        correoUsuario: usuarioDB.correoUsuario,
        usuarioAdministrador: usuarioDB.usuarioAdministrador,
        fotoUsuario: usuarioDB.fotoUsuario,
        codigoSesion: nuevaSesion.codigoSesion // 🟢 Ahora vive dentro del contexto del usuario
      },
      token
    };
  }

  async verificarClave(username, password) {
    if (!password) throw { statusCode: 400, msg: "La contraseña es requerida para validar." };

    const usuarioDB = await this.model.findOne({
      where: { userNameUsuario: username },
      attributes: { include: ['claveUsuario'] }
    });

    if (!usuarioDB) throw { statusCode: 404, msg: "Usuario no encontrado." };

    if (!usuarioDB.claveUsuario) {
      console.error(`El usuario ${username} no tiene un hash de contraseña en la BD.`);
      throw { statusCode: 500, msg: "Error de integridad: El usuario no tiene clave registrada." };
    }

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

  // 🟢 4. REFACTORIZADO: Un servicio no debe recibir req, res. Solo recibe los datos.
  async cerrarSesion(codigoUsuario) {
    if (codigoUsuario) {
      // Usamos this.model en lugar de PTLUsuarios
      await this.model.update(
        { isOnline: false },
        { where: { codigoUsuario } }
      );

      // Usamos el helper getIO de forma segura
      try {
        const io = getIO();
        io.emit("usuariosActualizados");
      } catch (error) {
        console.warn("⚠️ No se pudo emitir usuariosActualizados por socket:", error.message);
      }
    }
    return { success: true, message: "Sesión cerrada correctamente" };
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