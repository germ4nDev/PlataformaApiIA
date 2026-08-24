/*
    Author: German Valencia
    Refactored for: QPLUS Standard (Clean Service Layer) - Catálogo de Widgets
*/
const { sequelize } = require('../../database/connection');
const { CatalogoWidgetModel, CatalogoWidgetDTO } = require('../../models/torre-control/catalogo-widgets.model');
const { io } = require('../../index');

class WidgetService {
  constructor() {
    this.model = CatalogoWidgetModel(sequelize);
  }

  // Permite buscar todos o filtrar (ej. solo los activos para el Lobby)
  async getWidgets() {
    try {
      // Obtenemos los datos limpios
      const resultados = await this.model.findAll({ raw: true });
      return {
        ok: true,
        data: resultados,
        statusCode: 200
      };
    } catch (error) {
      console.error("🔴 Error en WidgetService (getWidgets):", error);
      throw error;
    }
  }

  async getWidgetByCode(codigo_widget) {
    try {
      const registro = await this.model.findOne({ where: { codigo_widget } });
      if (!registro) throw { statusCode: 404, msg: "No existe el widget solicitado en el catálogo." };
      return registro;
    } catch (error) {
      console.error("🔴 Error en WidgetService (getWidgetByCode):", error);
      throw error;
    }
  }

  async crearWidget(rawData, userContext = { codigoUsuario: 'SISTEMA_ADMIN' }) {
    try {
      // 1. Saneamiento y Validación (Escudo QPLUS)
      const dataDTO = CatalogoWidgetDTO(rawData, userContext);

      return await sequelize.transaction(async (t) => {
        const nuevoWidget = await this.model.create(dataDTO, { transaction: t });
        console.log('✅ Widget creado en BD:', nuevoWidget.toJSON());

        // 3. Reactividad
        if (typeof io !== 'undefined') {
          io.emit('widgets-actualizados', {
            action: 'create',
            msg: `Nuevo widget registrado: ${nuevoWidget.nombre}`
          });
        }

        return nuevoWidget;
      });

    } catch (error) {
      console.error('🔴 Error COMPLETO en crearWidget:', error);
      throw error;
    }
  }

  async updateWidget(codigo_widget, rawData, userContext = { codigoUsuario: 'SISTEMA_ADMIN' }) {
    try {
      const dataDTO = CatalogoWidgetDTO(rawData, userContext);

      return await sequelize.transaction(async (t) => {
        const dbWidget = await this.model.findOne({
          where: { codigo_widget },
          transaction: t
        });

        if (!dbWidget) {
          throw { statusCode: 404, msg: "No existe el widget para actualizar." };
        }

        await this.model.update(dataDTO, {
          where: { codigo_widget },
          transaction: t
        });

        const actualizado = await this.model.findOne({
          where: { codigo_widget },
          transaction: t
        });

        if (typeof io !== 'undefined') {
          io.emit('widgets-actualizados', {
            action: 'update',
            msg: `Widget actualizado: ${actualizado.nombre}`
          });
        }

        return actualizado;
      });

    } catch (error) {
      console.error(`🔴 Error en updateWidget:`, error.msg || error.message);
      throw error;
    }
  }

  async deleteWidget(codigo_widget) {
    try {
      return await sequelize.transaction(async (t) => {
        const dbWidget = await this.model.findOne({
          where: { codigo_widget },
          transaction: t
        });

        if (!dbWidget) {
          throw { statusCode: 404, msg: "No existe un widget con ese código." };
        }

        await this.model.destroy({
          where: { codigo_widget },
          transaction: t
        });

        if (typeof io !== 'undefined') {
          io.emit('widgets-actualizados', {
            action: 'delete',
            msg: `Widget eliminado del catálogo: ${dbWidget.nombre}`
          });
        } else {
          console.warn('⚠️ Objeto IO no definido. Se eliminó en BD pero no se notificó por socket.');
        }

        return dbWidget;
      });

    } catch (error) {
      console.error(`🔴 Error en deleteWidget (Rollback):`, error.msg || error.message);
      throw error;
    }
  }
}

module.exports = WidgetService;