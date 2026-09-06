/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Service Layer Sanitization & Transactional Integrity
*/
const { sequelize } = require("../database/connection");
const { ActividadRoleModel, ActividadRoleDTO } = require("../models/actividad-role.model");

// 🟢 1. IMPORTA AQUÍ EL MODELO DE ACTIVIDADES MAESTRAS
// (Por favor ajusta la ruta "../models/actividad" y el nombre "ActividadModel" según como lo tengas en tu proyecto)
const { ActividadModel } = require("../models/actividad");

const { io } = require("../index");

class ActividadesRolesService {
  constructor() {
    this.model = ActividadRoleModel(sequelize);

    this.actividadModel = ActividadModel(sequelize);

    this.model.belongsTo(this.actividadModel, {
      foreignKey: 'codigoActividad',
      targetKey: 'codigoActividad',
      as: 'actividad'
    });
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

  async getActividadByCodeRole(codigoRole) {
    try {
      const data = await this.model.findAll({
        where: {
          codigoRole: codigoRole,
          permiso: true
        },
        include: [
          {
            model: this.actividadModel,
            as: 'actividad',

            attributes: ['codigoActividad', 'llavePermiso', 'actividad', 'estadoActividad'],

            where: {
              estadoActividad: true
            },

            required: true
          }
        ]
      });

      console.log(`✅ Permisos encontrados para el rol ${codigoRole}:`, data.length);

      return { ok: true, data: data };

    } catch (error) {
      console.error('❌ Error al cruzar actividades por rol:', error);
      throw error;
    }
  }

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
      console.error(`Error en createActividadRole:`, error);
      throw error;
    }
  }

  async updateActividadRole(id, rawData) {
    try {
      const dataDTO = ActividadRoleDTO(rawData);

      return await sequelize.transaction(async (t) => {
        const registroDB = await this.model.findOne({
          where: { codigoActividadRole: id },
          transaction: t
        });

        if (!registroDB) throw { statusCode: 404, msg: "No se encontró el registro para actualizar." };

        await this.model.update(dataDTO, {
          where: { codigoActividadRole: id },
          transaction: t
        });

        io.emit('actividades-roles-actualizadas', {
          action: 'update',
          msg: `Relación creada`
        });

        return await this.model.findOne({
          where: { codigoActividadRole: id },
          transaction: t
        });

      });
    } catch (error) {
      console.error(`Error en updateActividadRole:`, error);
      throw error;
    }
  }

  async deleteActividadRole(id) {
    return await sequelize.transaction(async (t) => {
      const eliminado = await this.model.destroy({
        where: { codigoActividadRole: id },
        transaction: t
      });

      if (eliminado === 0) throw { statusCode: 404, msg: "No se encontró el registro para eliminar." };

      io.emit("actividades-roles-actualizadas", { action: "delete", msg: "Relación eliminada" });

      return true;
    });
  }

  async syncActividadesRoles(codigoActividad, rawDataArray) {
    try {
      // 🟢 NUEVO: Garantizamos que siempre sea un Arreglo nativo
      const arregloReal = Array.isArray(rawDataArray)
        ? rawDataArray
        : Object.values(rawDataArray || {});

      // 1. Ahora sí usamos .map() sin riesgo de crash
      const dataDTOArray = arregloReal.map(item => ActividadRoleDTO(item));

      return await sequelize.transaction(async (t) => {
        // ... (El resto de tu código queda exactamente igual)
        await this.model.destroy({
          where: { codigoActividad: codigoActividad },
          transaction: t
        });

        let nuevosRegistros = [];
        if (dataDTOArray.length > 0) {
          nuevosRegistros = await this.model.bulkCreate(dataDTOArray, { transaction: t });
        }

        if (typeof io !== 'undefined') {
          io.emit('actividades-roles-actualizadas', { action: 'sync', msg: 'Sincronizado' });
        }

        return nuevosRegistros;
      });
    } catch (error) {
      console.error(`❌ Error en syncActividadesRoles:`, error);
      throw error;
    }
  }
}

module.exports = ActividadesRolesService;