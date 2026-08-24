/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Service Layer Sanitization & Transactional Integrity
*/
const { sequelize } = require('../database/connection');
const { UsuarioSCModel, UsuarioSCDTO } = require('../models/usuario-sc');
const { io } = require('../index');

class UsuarioSCService {
  constructor() {
    this.model = UsuarioSCModel(sequelize);
  }

  async getUsuariosSC() {
    return await this.model.findAll();
  }

  async getUsuarioSCById(codigoUsuarioSC) {
    const usuarioSC = await this.model.findOne({
      where: { codigoUsuarioSC }
    });

    if (!usuarioSC) {
      throw { statusCode: 404, msg: "No existe el usuario SC solicitado." };
    }

    return usuarioSC;
  }

  async getUsuariosSCBySuscriptorCode(codigoSuscriptor) {
    const usuariosSC = await this.model.findAll({
      where: { codigoSuscriptor }
    });

    if (!usuariosSC || usuariosSC.length === 0) {
      throw { statusCode: 404, msg: "No existen usuarios para ese suscriptor." };
    }

    return usuariosSC;
  }

  async createUsuarioSC(rawData) {
    const dataDTO = UsuarioSCDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const nuevo = await this.model.create(dataDTO, { transaction: t });

      io.emit("usuarios-sc-actualizados", {
        action: "create",
        msg: `Usuario Suscriptor creado: ${nuevo.codigoUsuarioSC}`
      });

      return nuevo;
    });
  }

  /**
   * Actualiza un usuario SC existente ERROREXISTEID
   */
  async updateUsuarioSC(codigoUsuarioSC, rawData) {
    // El controlador inyecta el codigoUsuario en rawData antes de invocar este método
    const dataDTO = UsuarioSCDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const usuarioSCDB = await this.model.findOne({
        where: { codigoUsuarioSC },
        transaction: t
      });

      if (!usuarioSCDB) {
        throw { statusCode: 404, msg: "No existe el usuario SC para actualizar." };
      }

      await this.model.update(dataDTO, {
        where: { codigoUsuarioSC },
        transaction: t
      });

      const usuarioSCActualizado = await this.model.findOne({
        where: { codigoUsuarioSC },
        transaction: t
      });

      io.emit('usuarios-sc-actualizados', {
        action: 'update',
        msg: `Usuario Suscriptor actualizado: ${usuarioSCActualizado.codigoUsuarioSC}`
      });

      return usuarioSCActualizado;
    });
  }

  async deleteUsuarioSC(codigoUsuarioSC) {
    return await sequelize.transaction(async (t) => {
      const usuarioSCDB = await this.model.findOne({
        where: { codigoUsuarioSC },
        transaction: t
      });

      if (!usuarioSCDB) {
        throw { statusCode: 404, msg: "No existe el usuario SC con ese ID para eliminar." };
      }

      const codigoEliminado = usuarioSCDB.codigoUsuarioSC;

      const resultado = await this.model.destroy({
        where: { codigoUsuarioSC },
        transaction: t
      });

      io.emit('usuarios-sc-actualizados', {
        action: 'delete',
        msg: `Usuario Suscriptor eliminado: ${codigoEliminado}`
      });

      return resultado;
    });
  }
}

module.exports = UsuarioSCService;