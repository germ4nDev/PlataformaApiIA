/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Service Layer Sanitization & Transactional Integrity
*/
const { sequelize } = require("../database/connection");
const { ActividadRoleModel, ActividadRoleDTO } = require("../models/actividad-role");
const { io } = require("../index");

class ActividadesRolesService {
  constructor() {
    this.model = ActividadRoleModel(sequelize);
  }

  async getActividadesRoles() {
    return await this.model.findAll();
  }

  async getPorCodigoActividad(codigoActividad) {
    const registros = await this.model.findAll({ where: { codigoActividad } });
    if (!registros || registros.length === 0)
      throw { statusCode: 404, msg: "No se encontraron registros para la actividad especificada." };
    return registros;
  }

  async getPorCodigoRole(codigoRole) {
    const registros = await this.model.findAll({ where: { codigoRole } });
    if (!registros || registros.length === 0)
      throw { statusCode: 404, msg: "No se encontraron registros para el rol especificado." };
    return registros;
  }

  /**
   * Crea una nueva relación Actividad-Rol
   * @param {Object} rawData - Datos validados por el controlador (via DTO)
   */
  async createActividadRole(rawData) {
    try {
      const dataDTO = ActividadRoleDTO(rawData);

      return await sequelize.transaction(async (t) => {
        const existe = await this.model.findOne({
          where: {
            codigoActividad: dataDTO.codigoActividad,
            codigoRole: dataDTO.codigoRole,
          },
          transaction: t
        });

        if (existe) throw { statusCode: 400, msg: "Esta relación Actividad-Rol ya existe." };

        const nuevaRelacion = await this.model.create(dataDTO, { transaction: t });

        if (typeof io !== 'undefined') {
          io.emit('actividades-roles-actualizadas', {
            action: 'create',
            msg: `Relación creada`
          });
        } else {
          console.warn('Objeto IO no definido. No se emitió el socket, pero se guardó en BD.');
        }
        return nuevaRelacion;
      });
    } catch (error) {
      console.error(`Error en updateAplicacion:`, error);
      throw error;
    }
  }

  /**
   * Actualiza una relación existente
   */
  async updateActividadRole(codigoActividad, codigoRole, rawData) {
    try {
      const dataDTO = ActividadRoleDTO(rawData);

      return await sequelize.transaction(async (t) => {
        const registroDB = await this.model.findOne({
          where: { codigoActividad, codigoRole },
          transaction: t
        });

        if (!registroDB) throw { statusCode: 404, msg: "No se encontró el registro para actualizar." };

        await this.model.update(dataDTO, {
          where: { codigoActividad, codigoRole },
          transaction: t
        });

        return await this.model.findOne({
          where: { codigoActividad, codigoRole },
          transaction: t
        });
      });
    } catch (error) {
      console.error(`Error en updateAplicacion:`, error);
      throw error;
    }
  }

  async deleteActividadRole(codigoActividad, codigoRole) {
    return await sequelize.transaction(async (t) => {
      const eliminado = await this.model.destroy({
        where: { codigoActividad, codigoRole },
        transaction: t
      });

      if (eliminado === 0) throw { statusCode: 404, msg: "No se encontró el registro para eliminar." };

      io.emit("actividades-roles-actualizadas", { action: "delete", msg: "Relación eliminada" });

      return true;
    });
  }
}

module.exports = ActividadesRolesService;