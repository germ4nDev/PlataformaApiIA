/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Security & Transactional Integrity
*/
const { sequelize } = require('../database/connection');
const { WidgetMaestroModel, WidgetMaestroDTO } = require('../models/widget');
const { io } = require('../index');

class WidgetsService {
  constructor() {
    this.model = WidgetMaestroModel(sequelize);
  }

  async getWidgetsActivos() {
    try {
      return await this.model.findAll({
        order: [['nombreWidget', 'ASC']]
      });
    } catch (error) {
      console.error("Error en WidgetsService:", error);
      throw error;
    }
  }

  async getWidgetById(codigoWidget) {
    const widget = await this.model.findOne({
      where: { codigoWidget }
    });

    if (!widget) {
      throw { statusCode: 404, msg: "No existe el widget solicitado." };
    }

    return widget;
  }

  async createWidget(rawData) {
    console.log('data widget antes dto', rawData);
    const dataDTO = WidgetMaestroDTO(rawData);
    console.log('data widget despues dto', dataDTO);

    return await sequelize.transaction(async (t) => {
      const existeWidget = await this.model.findOne({
        where: { codigoWidget: dataDTO.codigoWidget },
        transaction: t
      });

      if (existeWidget) {
        throw {
          statusCode: 400,
          msg: "Ya existe un widget registrado con ese código.",
          detalle: existeWidget
        };
      }

      const widgetDB = await this.model.create(dataDTO, { transaction: t });

      io.emit("widgets-actualizados", {
        action: "create",
        msg: `Nuevo widget disponible: ${widgetDB.nombreWidget}`
      });

      return widgetDB;
    });
  }

  async updateWidget(codigoWidget, rawData) {
    console.log('data widget antes dto', rawData);
    // Aseguramos mantener el código original para que el DTO no falle si no se envía en el body
    rawData.codigoWidget = codigoWidget;
    const dataDTO = WidgetMaestroDTO(rawData);
    console.log('data widget despues dto', dataDTO);

    return await sequelize.transaction(async (t) => {
      const widgetDB = await this.model.findOne({
        where: { codigoWidget },
        transaction: t
      });

      if (!widgetDB) {
        throw { statusCode: 404, msg: "No existe el widget con ese código para actualizar." };
      }

      await this.model.update(dataDTO, {
        where: { codigoWidget },
        transaction: t
      });

      const widgetActualizado = await this.model.findOne({
        where: { codigoWidget },
        transaction: t
      });

      io.emit("widgets-actualizados", {
        action: "update",
        msg: `Widget actualizado: ${widgetActualizado.nombreWidget}`
      });

      return widgetActualizado;
    });
  }

  async deleteWidget(codigoWidget) {
    return await sequelize.transaction(async (t) => {
      const widgetDB = await this.model.findOne({
        where: { codigoWidget },
        transaction: t
      });

      if (!widgetDB) {
        throw { statusCode: 404, msg: "No existe el widget con ese código para eliminar." };
      }

      const nombreWidget = widgetDB.nombreWidget;

      // 🟢 Borrado Lógico: Actualizamos el estado a false para no romper los tableros guardados de los usuarios
      await this.model.update({ estadoWidget: false }, {
        where: { codigoWidget },
        transaction: t
      });

      io.emit("widgets-actualizados", {
        action: "delete",
        msg: `Widget desactivado: ${nombreWidget}`
      });

      return { codigoWidget, estadoWidget: false };
    });
  }
}

module.exports = WidgetsService;