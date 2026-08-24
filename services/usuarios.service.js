/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Security & Transactional Integrity
*/
const { sequelize } = require('../database/connection');
const bcrypt = require("bcryptjs");
const { UsuarioModel, UsuarioDTO } = require('../models/usuario');
const { io } = require('../index');

class UsuariosService {
  constructor() {
    this.model = UsuarioModel(sequelize);
  }

  async getUsuarios(filtros = {}, esParaIA = false) {
    try {
      const queryOptions = {
        where: filtros,
      };

      if (esParaIA) {
        queryOptions.attributes = [
          'userNameUsuario',
          'nombreUsuario',
          'identificacionUsuario',
          'correoUsuario'
        ];
      }

      return await this.model.findAll(queryOptions);

    } catch (error) {
      console.error("Error en UsuariosService:", error);
      throw error;
    }
  }

  async getUsuarioById(codigoUsuario) {
    const usuario = await this.model.findOne({
      where: { codigoUsuario },
    });

    if (!usuario) {
      throw { statusCode: 404, msg: "No existe el usuario solicitado." };
    }

    return usuario;
  }

  /**
   * Valida las credenciales de acceso comparando el hash bcrypt
   */
  async validatePassword(codigoAdministrador, claveActual) {
    const usuarioDB = await this.model.findOne({
      where: { codigoUsuario: codigoAdministrador }
    });

    if (!usuarioDB) {
      throw { statusCode: 404, msg: "No existe el usuario para validar." };
    }

    const isMatch = await bcrypt.compare(claveActual, usuarioDB.claveUsuario);

    if (!isMatch) {
      throw { statusCode: 400, msg: "Contraseña no válida." };
    }

    return usuarioDB;
  }

  /**
   * Crea un nuevo usuario encriptando su contraseña
   */
  async createUsuario(rawData) {
    console.log('data usuario antes dto', rawData);
    const dataDTO = UsuarioDTO(rawData);
    console.log('data usuario despues dto', dataDTO);

    return await sequelize.transaction(async (t) => {
      const existeIdentificacion = await this.model.findOne({
        where: { identificacionUsuario: dataDTO.identificacionUsuario },
        transaction: t
      });

      if (existeIdentificacion) {
        throw {
          statusCode: 400,
          msg: "Ya existe un usuario con esa identificación.",
          usuario: existeIdentificacion
        };
      }

      // Encriptación de seguridad
      const salt = bcrypt.genSaltSync();
      dataDTO.claveUsuario = await bcrypt.hash(dataDTO.claveUsuario, salt);
      dataDTO.fotoUsuario = 'no-imagen.png';

      const usuarioDB = await this.model.create(dataDTO, { transaction: t });

      io.emit("usuarios-actualizados", {
        action: "create",
        msg: `Usuario creado: ${usuarioDB.nombreUsuario}`
      });

      return usuarioDB;
    });
  }

  /**
   * Actualiza la información general del usuario (excluyendo contraseña)
   */
  async updateUsuario(codigoUsuario, rawData) {
    // El controlador inyecta la auditoría en rawData antes de invocar este método
    const dataDTO = UsuarioDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const usuarioDB = await this.model.findOne({
        where: { codigoUsuario },
        transaction: t
      });

      if (!usuarioDB) {
        throw { statusCode: 404, msg: "No existe el usuario con ese ID para actualizar." };
      }

      await this.model.update(dataDTO, {
        where: { codigoUsuario },
        transaction: t
      });

      const usuarioActualizado = await this.model.findOne({
        where: { codigoUsuario },
        transaction: t
      });

      io.emit("usuarios-actualizados", {
        action: "update",
        msg: `Usuario actualizado: ${usuarioActualizado.nombreUsuario}`
      });

      return usuarioActualizado;
    });
  }

  /**
   * Endpoint específico para el cambio de contraseña
   */
  async updateUsuarioPassword(codigoUsuario, data) {
    return await sequelize.transaction(async (t) => {
      const usuarioDB = await this.model.findOne({
        where: { codigoUsuario },
        transaction: t
      });

      if (!usuarioDB) {
        throw { statusCode: 404, msg: "No existe el usuario con ese ID para actualizar la clave." };
      }

      const salt = bcrypt.genSaltSync();
      const hashedPassword = await bcrypt.hash(data.claveUsuario, salt);

      await this.model.update({ claveUsuario: hashedPassword }, {
        where: { codigoUsuario },
        transaction: t
      });

      const usuarioActualizado = await this.model.findOne({
        where: { codigoUsuario },
        transaction: t
      });

      io.emit("usuarios-actualizados", {
        action: "update",
        msg: `Clave de usuario actualizada: ${usuarioActualizado.nombreUsuario}`
      });

      return usuarioActualizado;
    });
  }

  async deleteUsuario(codigoUsuario) {
    return await sequelize.transaction(async (t) => {
      const usuarioDB = await this.model.findOne({
        where: { codigoUsuario },
        transaction: t
      });

      if (!usuarioDB) {
        throw { statusCode: 404, msg: "No existe el usuario con ese ID para eliminar." };
      }

      const nombreUsuario = usuarioDB.nombreUsuario;

      const resultado = await this.model.destroy({
        where: { codigoUsuario },
        transaction: t
      });

      io.emit("usuarios-actualizados", {
        action: "delete",
        msg: `Usuario eliminado: ${nombreUsuario}`
      });

      return resultado;
    });
  }
}

module.exports = UsuariosService;