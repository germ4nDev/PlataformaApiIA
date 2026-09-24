/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Security & Transactional Integrity
*/
const { sequelize } = require('../database/connection');
const bcrypt = require("bcryptjs");
const { UsuarioModel, UsuarioDTO } = require('../models/usuario');
const { getIO } = require('../helpers/socket.helper');
const xlsx = require('xlsx');
const crypto = require('crypto');

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

  async createUsuario(rawData) {
    const dataDTO = UsuarioDTO(rawData);

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
      dataDTO.fotoUsuario = 'no_imagen.png';

      const usuarioDB = await this.model.create(dataDTO, { transaction: t });

      getIO().emit("usuarios-actualizados", {
        action: "create",
        msg: `Usuario creado: ${usuarioDB.nombreUsuario}`
      });

      return usuarioDB;
    });
  }

  async cargueMasivoExcel(fileBuffer, usuarioCreador) {
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const rawDataArray = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    if (!rawDataArray || rawDataArray.length === 0) {
      throw { statusCode: 400, msg: 'El archivo Excel está vacío o no tiene formato válido.' };
    }

    const usuariosLimpios = [];
    const erroresValidacion = [];

    rawDataArray.forEach((fila, index) => {
      try {
        const rawUsuario = {
          codigoUsuario: fila.codigoUsuario || crypto.randomUUID(),
          identificacionUsuario: String(fila.identificacionUsuario || ''),
          nombreUsuario: fila.nombreUsuario,
          correoUsuario: fila.correoUsuario,
          userNameUsuario: fila.userNameUsuario || '',
          claveUsuario: String(fila.claveUsuario || crypto.randomUUID().substring(0, 8)),
          descripcionUsuario: fila.descripcionUsuario || '',
          fotoUsuario: fila.fotoUsuario || 'no_imagen.png',
          usuarioAdministrador: fila.usuarioAdministrador === 'SI' || fila.usuarioAdministrador === true,
          estadoUsuario: true,
          codigoUsuarioCreacion: usuarioCreador,
          fechaCreacion: new Date().toISOString(),
          codigoUsuarioModificacion: usuarioCreador,
          fechaModificacion: new Date().toISOString()
        };

        const usuarioDTO = UsuarioDTO(rawUsuario);
        usuariosLimpios.push(usuarioDTO);
      } catch (error) {
        erroresValidacion.push({ filaExcel: index + 2, detalles: error.details || error });
      }
    });

    if (erroresValidacion.length > 0) {
      throw { statusCode: 400, msg: 'Errores de validación en el archivo.', errores: erroresValidacion };
    }

    // 2. Ejecutar inserción transaccional
    const resultado = await sequelize.transaction(async (t) => {
      try {
        return await this.model.bulkCreate(usuariosLimpios, { transaction: t });
      } catch (dbError) {
        throw { statusCode: 409, msg: 'Error de integridad en BD. Correos o identificaciones duplicadas.', detalle: dbError.message };
      }
    });

    // 🟢 3. Emitir el evento de actualización a todas las interfaces conectadas
    getIO().emit('usuarios-actualizados', {
      action: "update",
      msg: 'Cargue masivo completado. Refrescando tabla...'
    });

    return resultado;
  }

  async updateUsuario(codigoUsuario, rawData) {
    if (rawData.fotoUsuario == "") (
      rawData.fotoUsuario = 'mantenerFoto'
    )
    const dataDTO = UsuarioDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const usuarioDB = await this.model.findOne({
        where: { codigoUsuario: dataDTO.codigoUsuario },
        transaction: t
      });

      if (!usuarioDB) {
        throw { statusCode: 404, msg: "No existe el usuario con ese ID para actualizar." };
      }
      const usuActualizar = usuarioDB.dataValues;

      if (rawData.claveUsuario != usuActualizar.claveUsuario) {
        console.log('cambiar clave', usuActualizar.claveUsuario);
        const salt = bcrypt.genSaltSync();
        const hashedPassword = await bcrypt.hash(rawData.claveUsuario, salt);
        usuActualizar.claveUsuario = hashedPassword
      }

      if (rawData.fotoUsuario != 'mantenerFoto') {
        usuActualizar.fotoUsuario = rawData.fotoUsuario
      }

      await this.model.update(usuActualizar, {
        where: { codigoUsuario: dataDTO.codigoUsuario },
        transaction: t
      });

      const usuarioActualizado = await this.model.findOne({
        where: { codigoUsuario: dataDTO.codigoUsuario },
        transaction: t
      });

      getIO().emit("usuarios-actualizados", {
        action: "update",
        msg: `Usuario actualizado: ${usuarioActualizado.nombreUsuario}`
      });

      return usuarioActualizado;
    });
  }

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

      getIO().emit("usuarios-actualizados", {
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

      getIO().emit("usuarios-actualizados", {
        action: "delete",
        msg: `Usuario eliminado: ${nombreUsuario}`
      });

      return resultado;
    });
  }
}

module.exports = UsuariosService;