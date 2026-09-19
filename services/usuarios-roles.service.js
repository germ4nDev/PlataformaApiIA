/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Bulk Synchronization & Transactional Integrity
*/
const { sequelize } = require("../database/connection");
const { UsuarioRoleModel, UsuarioRoleDTO } = require("../models/usuario-role");
const { RoleAPModel } = require("../models/role");
const { UsuarioModel } = require("../models/usuario");
const { Op } = require('sequelize');
const { getIO } = require('../helpers/socket.helper');

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

  async createUsuarioRole(rawData) {
    const dataDTO = UsuarioRoleDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const nuevo = await this.model.create(dataDTO, { transaction: t });
      this.emitSocket('create', 'Relación Usuario-Rol creada.');
      return nuevo;
    });
  }

  async sincronizarRolesUsuario(payload) {
    const { codigoUsuarioSC, rolesContexto, roles } = payload;

    const transaction = await sequelize.transaction();

    try {
      if (rolesContexto && rolesContexto.length > 0) {
        await this.model.destroy({
          where: {
            codigoUsuarioSC: codigoUsuarioSC,
            codigoRole: {
              [Op.in]: rolesContexto // Borra donde codigoRole esté en el array
            }
          },
          transaction
        });
      }

      if (roles && roles.length > 0) {
        await this.model.bulkCreate(roles, { transaction });
      }

      await transaction.commit();
      return { msg: 'Roles sincronizados correctamente' };

    } catch (error) {
      await transaction.rollback();
      console.error("🔴 ERROR SEQUELIZE:", error);

      const mensajeReal = error.original ? error.original.message : error.message;
      throw { statusCode: 500, msg: 'Error al sincronizar roles: ' + mensajeReal };
    }
  }

  async sincronizarUsuariosDelRole(payload) {
    const { codigoRole, usuariosContexto, relaciones } = payload;
    const transaction = await sequelize.transaction();

    try {
      // 1. ELIMINAR las relaciones de este rol con los usuarios visualizados actualmente
      if (usuariosContexto && usuariosContexto.length > 0) {
        await this.model.destroy({
          where: {
            codigoRole: codigoRole,
            codigoUsuarioSC: {
              [Op.in]: usuariosContexto
            }
          },
          transaction
        });
      }

      // 2. INSERTAR la nueva selección
      if (relaciones && relaciones.length > 0) {
        await this.model.bulkCreate(relaciones, { transaction });
      }

      await transaction.commit();
      return { msg: 'Usuarios sincronizados con el rol exitosamente' };

    } catch (error) {
      await transaction.rollback();
      console.error("🔴 ERROR SEQUELIZE:", error);
      const mensajeReal = error.original ? error.original.message : error.message;
      throw { statusCode: 500, msg: 'Error al asociar usuarios: ' + mensajeReal };
    }
  }

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

  async updateUsuarioRole(codigoUsuarioRole, rawData) {
    console.log('rawData', rawData);
    console.log('codigoUsuarioRole', codigoUsuarioRole);

    const dataDTO = UsuarioRoleDTO(rawData);
    console.log('dataDTO', dataDTO);

    return await sequelize.transaction(async (t) => {
      // 1. Validar existencia usando el nombre correcto de la columna
      const usuarioSCDB = await this.model.findOne({
        where: { codigoUsuarioRole },
        transaction: t
      });

      if (!usuarioSCDB) {
        throw { statusCode: 404, msg: "No existe el usuario SC para actualizar." };
      }

      // 2. Ejecutar la actualización
      await this.model.update(dataDTO, {
        where: { codigoUsuarioRole },
        transaction: t
      });

      // 3. Recuperar el registro actualizado
      const usuarioSCActualizado = await this.model.findOne({
        where: { codigoUsuarioRole },
        transaction: t
      });

      // 4. Emitir el evento de Socket (Asegúrate de tener 'io' disponible en este scope)
      getIO().emit('usuarios-roles-actualizados', {
        action: 'update',
        msg: `Usuario Roles actualizado: ${usuarioSCActualizado.codigoUsuarioRole}`
      });

      return usuarioSCActualizado;
    });
  }

  async deleteUsuarioRole(codigoUsuarioRole) {
    return await sequelize.transaction(async (t) => {
      const registro = await this.model.findOne({ where: { codigoUsuarioRole }, transaction: t });
      if (!registro) throw { statusCode: 404, msg: "Relación no encontrada." };

      await this.model.destroy({ where: { codigoUsuarioRole }, transaction: t });
      this.emitSocket('delete', 'Relación Usuario-Rol eliminada.');
      return true;
    });
  }

  emitSocket(action, msg) {
    getIO().emit("usuarios-roles-actualizados", { action, msg });
  }
}

module.exports = UsuariosRolesService;