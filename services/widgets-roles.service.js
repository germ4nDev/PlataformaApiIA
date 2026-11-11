/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Service Layer Sanitization & Transactional Integrity
*/
const { sequelize } = require("../database/connection");
const { WidgetRoleModel, WidgetRoleDTO } = require("../models/widget-role");

// 🟢 1. IMPORTA AQUÍ EL MODELO DE ACTIVIDADES MAESTRAS
// (Por favor ajusta la ruta "../models/widget" y el nombre "WidgetMaestroModel" según como lo tengas en tu proyecto)
const { WidgetMaestroModel } = require("../models/widget");

// Evento que escucha la web (socket-manager: 'widgets-roles-actualizados'). Antes salía 'widgetes-roles-actualizadas' y nadie lo oía.
const { emitir } = require('../helpers/socket.helper');
const EVENTO_WIDGETS_ROLES = 'widgets-roles-actualizados';

class WidgetesRolesService {
  constructor() {
    this.model = WidgetRoleModel(sequelize);

    this.widgetModel = WidgetMaestroModel(sequelize);

    this.model.belongsTo(this.widgetModel, {
      foreignKey: 'codigoWidget',
      targetKey: 'codigoWidget',
      as: 'widget'
    });
  }

  async getWidgetsRoles() {
    return await this.model.findAll();
  }

  /** Relaciones de un widget (GET /api/widgets-roles/acti/:ac). El controlador la llamaba y no existía. */
  async getWidgetByCodeWidget(codigoWidget) {
    return await this.model.findAll({ where: { codigoWidget } });
  }

  /** Una relación por su código (la usa el controlador antes de borrar para avisar al rol). */
  async getWidgetRoleById(codigoWidgetRole) {
    return await this.model.findOne({ where: { codigoWidgetRole } });
  }

  async getPorCodigoWidget(codigoWidget) {
    const registros = await this.model.findAll({ where: { codigoWidget } });
    if (!registros || registros.length === 0)
      throw { statusCode: 404, msg: "No se encontraron registros para la widget especificada." };
    return registros;
  }

  async getWidgetByCodeRole(codigoRole) {
    try {
      const data = await this.model.findAll({
        where: {
          codigoRole: codigoRole,
          // Corregido 2026-11-02 (admin-widgets): filtraba por 'permiso', columna que no existe en PTL_WidgetsRoles.
          estadoRelacion: true
        },
        include: [
          {
            model: this.widgetModel,
            as: 'widget',
            attributes: ['codigoWidget', 'llavePermiso', 'widget', 'estadoWidget'],

            where: {
              estadoWidget: true
            },

            required: true
          }
        ]
      });

      return { ok: true, data: data };

    } catch (error) {
      console.error('❌ Error al cruzar widgetes por rol:', error);
      throw error;
    }
  }

  async createWidgetRole(rawData) {
    try {
      const dataDTO = WidgetRoleDTO(rawData);

      return await sequelize.transaction(async (t) => {
        const existe = await this.model.findOne({
          where: {
            codigoWidget: dataDTO.codigoWidget,
            codigoRole: dataDTO.codigoRole,
          },
          transaction: t
        });

        if (existe) throw { statusCode: 400, msg: "Esta relación Widget-Rol ya existe." };

        const nuevaRelacion = await this.model.create(dataDTO, { transaction: t });

        // Después del commit: antes avisaba dentro de la transacción y la web releía la lista vieja (regla 18, fase 2)
        t.afterCommit(() => emitir(EVENTO_WIDGETS_ROLES, {
          action: 'create',
          msg: `Relación creada`
        }));

        return nuevaRelacion;
      });
    } catch (error) {
      console.error(`Error en createWidgetRole:`, error);
      throw error;
    }
  }

  async updateWidgetRole(id, rawData) {
    try {
      const dataDTO = WidgetRoleDTO(rawData);

      return await sequelize.transaction(async (t) => {
        const registroDB = await this.model.findOne({
          where: { codigoWidgetRole: id },
          transaction: t
        });

        if (!registroDB) throw { statusCode: 404, msg: "No se encontró el registro para actualizar." };

        await this.model.update(dataDTO, {
          where: { codigoWidgetRole: id },
          transaction: t
        });

        t.afterCommit(() => emitir(EVENTO_WIDGETS_ROLES, {
          action: 'update',
          msg: `Relación actualizada`
        }));

        return await this.model.findOne({
          where: { codigoWidgetRole: id },
          transaction: t
        });

      });
    } catch (error) {
      console.error(`Error en updateWidgetRole:`, error);
      throw error;
    }
  }

  async deleteWidgetRole(id) {
    return await sequelize.transaction(async (t) => {
      const eliminado = await this.model.destroy({
        where: { codigoWidgetRole: id },
        transaction: t
      });

      if (eliminado === 0) throw { statusCode: 404, msg: "No se encontró el registro para eliminar." };

      t.afterCommit(() => emitir(EVENTO_WIDGETS_ROLES, { action: "delete", msg: "Relación eliminada" }));

      return true;
    });
  }

  async syncWidgetsRoles(codigoWidget, rawDataArray) {
    try {
      const arregloReal = Array.isArray(rawDataArray)
        ? rawDataArray
        : Object.values(rawDataArray || {});

      const dataDTOArray = arregloReal.map(item => WidgetRoleDTO(item));

      return await sequelize.transaction(async (t) => {
        await this.model.destroy({
          where: { codigoWidget: codigoWidget },
          transaction: t
        });

        let nuevosRegistros = [];
        if (dataDTOArray.length > 0) {
          nuevosRegistros = await this.model.bulkCreate(dataDTOArray, { transaction: t });
        }

        // Antes dependía de una variable 'io' que no existe aquí: la sincronización nunca avisaba.
        t.afterCommit(() => emitir(EVENTO_WIDGETS_ROLES, { action: 'sync', codigoWidget, msg: 'Sincronizado' }));

        return nuevosRegistros;
      });
    } catch (error) {
      console.error(`❌ Error en syncWidgetesRoles:`, error);
      throw error;
    }
  }
}

module.exports = WidgetesRolesService;