/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Service Layer Sanitization & Transactional Integrity
*/
const { sequelize } = require("../database/connection");
const { UsuarioEmpresaModel, UsuarioEmpresaDTO } = require("../models/usuario-empresa-sc");
const { io } = require("../index");

class UsuariosEmpresasSCService {
  constructor() {
    this.model = UsuarioEmpresaModel(sequelize);
  }

  async getUsuariosEmpresas() {
    return await this.model.findAll();
  }

  async getUsuarioEmpresaById(codigoUsuarioEmpresaSC) {
    const registro = await this.model.findOne({ where: { codigoUsuarioEmpresaSC } });
    if (!registro) throw { statusCode: 404, msg: "No existe la relación Usuario-Empresa solicitada." };
    return registro;
  }

  /**
   * Crea una nueva relación entre un usuario y una empresa (Suscriptor)
   */
  async createUsuarioEmpresa(rawData) {
    const dataDTO = UsuarioEmpresaDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const nuevo = await this.model.create(dataDTO, { transaction: t });

      io.emit('usuarios-empresas-actualizados', {
        action: 'create',
        msg: `Relación Usuario-Empresa creada correctamente.`
      });

      return nuevo;
    });
  }

  /**
   * Actualiza una relación existente
   */
  async updateUsuarioEmpresa(codigoUsuarioEmpresaSC, rawData) {
    // El controlador inyecta el codigoUsuario en rawData antes de invocar este método
    const dataDTO = UsuarioEmpresaDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoUsuarioEmpresaSC },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: "No existe la relación Usuario-Empresa para actualizar." };

      await this.model.update(dataDTO, {
        where: { codigoUsuarioEmpresaSC },
        transaction: t
      });

      const actualizado = await this.model.findOne({
        where: { codigoUsuarioEmpresaSC },
        transaction: t
      });

      io.emit('usuarios-empresas-actualizados', {
        action: 'update',
        msg: `Relación Usuario-Empresa actualizada.`
      });

      return actualizado;
    });
  }

  async deleteUsuarioEmpresa(codigoUsuarioEmpresaSC) {
    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoUsuarioEmpresaSC },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: "No existe la relación Usuario-Empresa con ese ID para eliminar." };

      await this.model.destroy({
        where: { codigoUsuarioEmpresaSC },
        transaction: t
      });

      io.emit('usuarios-empresas-actualizados', {
        action: 'delete',
        msg: `Relación Usuario-Empresa eliminada.`
      });

      return true;
    });
  }
}

module.exports = UsuariosEmpresasSCService;