/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Service Layer Sanitization & Transactional Integrity
*/
const { sequelize } = require('../database/connection');
const { RoleAPModel, RoleAPDTO } = require('../models/role');
const { io } = require('../index');

class RolesService {
  constructor() {
    this.model = RoleAPModel(sequelize);
  }

  async getRoles() {
    return await this.model.findAll();
  }

  async getRoleById(codigoRole) {
    const registro = await this.model.findOne({ where: { codigoRole } });
    if (!registro) throw { statusCode: 404, msg: "No existe el rol solicitado." };
    return registro;
  }

  async getRolesByAppCode(codigoAplicacion) {
    return await this.model.findAll({
      where: { codigoAplicacion }
    });
  }

  /**
   * Crea un nuevo rol de acceso
   */
  async createRole(rawData) {
    const dataDTO = RoleAPDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const nuevo = await this.model.create(dataDTO, { transaction: t });

      io.emit('roles-actualizados', {
        action: 'create',
        msg: `Rol creado: ${nuevo.nombreRole}`
      });

      return nuevo;
    });
  }

  /**
   * Actualiza un rol existente
   */
  async updateRole(codigoRole, rawData) {
    // El controlador inyecta codigoUsuario en rawData antes de invocar este método
    const dataDTO = RoleAPDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoRole },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: 'No existe el rol para actualizar.' };

      await this.model.update(dataDTO, {
        where: { codigoRole },
        transaction: t
      });

      const actualizado = await this.model.findOne({
        where: { codigoRole },
        transaction: t
      });

      io.emit('roles-actualizados', {
        action: 'update',
        msg: `Rol actualizado: ${actualizado.nombreRole}`
      });

      return actualizado;
    });
  }

  async deleteRole(codigoRole) {
    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoRole },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: 'No existe el rol con ese ID para eliminar.' };

      const nombreRole = registroDB.nombreRole;

      await this.model.destroy({
        where: { codigoRole },
        transaction: t
      });

      io.emit('roles-actualizados', {
        action: 'delete',
        msg: `Rol eliminado: ${nombreRole}`
      });

      return true;
    });
  }
}

module.exports = RolesService;