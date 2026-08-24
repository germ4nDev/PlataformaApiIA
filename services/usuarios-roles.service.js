/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Bulk Synchronization & Transactional Integrity
*/
const { sequelize } = require("../database/connection");
const { UsuarioRoleModel, UsuarioRoleDTO } = require("../models/usuario-role");
const { RoleAPModel } = require("../models/role");
const { UsuarioModel } = require("../models/usuario");
const { io } = require("../index");

class UsuariosRolesService {
  constructor() {
    this.model = UsuarioRoleModel(sequelize);
    this.roleModel = RoleAPModel(sequelize);
    this.usuarioModel = UsuarioModel(sequelize);
  }

  async getUsuariosRoles() {
    return await this.model.findAll();
  }

  async getUsuarioRoleById(usuarioRoleId) {
    const registro = await this.model.findOne({ where: { usuarioRoleId } });
    if (!registro) throw { statusCode: 404, msg: "No existe la relación Usuario-Rol solicitada." };
    return registro;
  }

  async obtenerPorUsuarioYEmpresa(codigoUsuarioSC, codigoEmpresaSC) {
    return await UsuarioRole.findAll({
      where: {
        codigoUsuarioSC: codigoUsuarioSC,
        codigoEmpresaSC: codigoEmpresaSC,
        estadoUsuarioRole: true
      }
    });
  }

  async getUsuariosByRoleCode(codigoRole) {
    return await this.model.findAll({ where: { codigoRole } });
  }

  async getRolesByUserId(codigoUsuarioSC) {
    return await this.model.findAll({ where: { codigoUsuarioSC } });
  }

  /**
   * Crea una relación individual Usuario-Rol
   */
  async createUsuarioRole(rawData) {
    const dataDTO = UsuarioRoleDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const nuevo = await this.model.create(dataDTO, { transaction: t });
      this.emitSocket('create', 'Relación Usuario-Rol creada.');
      return nuevo;
    });
  }

  /**
   * Sincronización masiva: Actualiza el Rol y regenera todas sus asociaciones de usuarios
   */
  async updateRoleAndUsers(codigoRole, datosRol, usuariosSeleccionados) {
    return await sequelize.transaction(async (t) => {
      // 1. Actualizar el modelo padre (Rol)
      await this.roleModel.update(datosRol, { where: { codigoRole }, transaction: t });

      // 2. Limpiar contexto anterior
      await this.model.destroy({ where: { codigoRole }, transaction: t });

      // 3. Recreación masiva
      if (usuariosSeleccionados?.length > 0) {
        const nuevasAsociaciones = usuariosSeleccionados.map(codUser => {
          return UsuarioRoleDTO({
            codigoRole: codigoRole,
            codigoUsuarioSC: codUser,
            codigoEmpresaSC: datosRol.codigoEmpresaSC || '',
            estadoUsuarioRole: true,
            codigoUsuario: datosRol.usuarioModificacion // Auditoría inyectada por el controlador
          });
        });
        await this.model.bulkCreate(nuevasAsociaciones, { transaction: t });
      }

      this.emitSocket('update', 'Rol y sus usuarios sincronizados correctamente.');
      return { success: true };
    });
  }

  /**
   * Sincronización masiva: Actualiza el Usuario y regenera todas sus asociaciones de roles
   */
  async updateUserAndRoles(codigoUsuario, datosUsuario, rolesSeleccionados) {
    return await sequelize.transaction(async (t) => {
      // 1. Actualizar el modelo padre (Usuario)
      await this.usuarioModel.update(datosUsuario, { where: { codigoUsuario }, transaction: t });

      // 2. Limpiar contexto anterior
      await this.model.destroy({ where: { codigoUsuarioSC: codigoUsuario }, transaction: t });

      // 3. Recreación masiva
      if (rolesSeleccionados?.length > 0) {
        const nuevasAsociaciones = rolesSeleccionados.map(rol => {
          return UsuarioRoleDTO({
            codigoUsuarioSC: codigoUsuario,
            codigoRole: rol.codigoRole,
            codigoEmpresaSC: datosUsuario.codigoEmpresaSC || '',
            estadoUsuarioRole: true,
            codigoUsuario: datosUsuario.codigoUsuarioModificacion // Auditoría inyectada por el controlador
          });
        });
        await this.model.bulkCreate(nuevasAsociaciones, { transaction: t });
      }

      this.emitSocket('update', 'Usuario y sus roles sincronizados correctamente.');
      return { success: true };
    });
  }

  async deleteUsuarioRole(usuarioRoleId) {
    return await sequelize.transaction(async (t) => {
      const registro = await this.model.findOne({ where: { usuarioRoleId }, transaction: t });
      if (!registro) throw { statusCode: 404, msg: "Relación no encontrada." };

      await this.model.destroy({ where: { usuarioRoleId }, transaction: t });
      this.emitSocket('delete', 'Relación Usuario-Rol eliminada.');
      return true;
    });
  }

  /**
   * Wrapper centralizado para emisión de WebSockets
   */
  emitSocket(action, msg) {
    io.emit("usuarios-roles-actualizados", { action, msg });
  }
}

module.exports = UsuariosRolesService;