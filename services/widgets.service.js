/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Security & Transactional Integrity
*/
const { sequelize } = require('../database/connection');
const { WidgetMaestroModel, WidgetMaestroDTO } = require('../models/widget');
const { io } = require('../index');
const { Op } = require('sequelize');
const { PTLLayouts } = require('../models/layout');

class WidgetsService {
  constructor() {
    this.model = WidgetMaestroModel(sequelize);
    this.layoutModel = PTLLayouts;
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
    rawData.codigoWidget = codigoWidget;
    const dataDTO = WidgetMaestroDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const widgetDB = await this.model.findOne({
        where: { codigoWidget },
        transaction: t
      });

      if (!widgetDB) {
        throw { statusCode: 404, msg: "No existe el widget con ese código para actualizar." };
      }

      // 🟢 FIX 1: Retiramos la llave primaria del payload para que SQL Server no bloquee el UPDATE
      const payloadDB = { ...dataDTO };
      delete payloadDB.codigoWidget;

      await this.model.update(payloadDB, {
        where: { codigoWidget },
        transaction: t
      });

      // 🟢 FIX 2: Aislamos la limpieza de layouts en un try/catch para que, si falla, 
      // NO cancele la actualización principal del widget.
      if (dataDTO.estadoWidget === false && widgetDB.estadoWidget === true) {
        console.log('inactivado el widget');
        try {
          await this.limpiarWidgetDeLayouts(codigoWidget, t);
        } catch (errorLayout) {
          console.error("⚠️ Error limpiando layouts, revisa la importación de tu modelo:", errorLayout.message);
        }
      }

      const widgetActualizado = await this.model.findOne({
        where: { codigoWidget },
        transaction: t
      });

      // 🟢 FIX 3: Aislamos la emisión del socket. Si 'io' no está definido en este archivo, 
      // Node arrojará un error, pero el catch evitará el rollback de la BD.
      try {
        // Asegúrate de que estás llamando a tu instancia de socket correctamente
        // Ej: req.io.emit(...) o global.io.emit(...) dependiendo de tu arquitectura
        io.emit("widgets-actualizados", {
          action: dataDTO.estadoWidget ? "update" : "inactivado",
          codigoWidget: codigoWidget,
          msg: `Widget ${dataDTO.estadoWidget ? 'actualizado' : 'inactivado'}: ${widgetActualizado.nombreWidget}`
        });
      } catch (errorSocket) {
        console.warn("⚠️ Advertencia: No se pudo emitir por socket:", errorSocket.message);
      }

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

      // 🟢 Borrado Lógico
      await this.model.update({ estadoWidget: false }, {
        where: { codigoWidget },
        transaction: t
      });

      // 🟢 NUEVO: Limpiamos los layouts inmediatamente
      await this.limpiarWidgetDeLayouts(codigoWidget, t);

      // Emitimos el evento de inactividad para que Angular lo quite de la pantalla en vivo
      io.emit("widgets-actualizados", {
        action: "inactivado",
        codigoWidget: codigoWidget,
        msg: `Widget retirado del catálogo: ${nombreWidget}`
      });

      return { codigoWidget, estadoWidget: false };
    });
  }

  // 🟢 Método Helper optimizado usando sequelize.models directamente
  // async limpiarWidgetDeLayouts(codigoWidget, t) {
  //   try {
  //     console.log('intentar actualizar el layout de los usuarios');

  //     // Sequelize registra todos los modelos definidos bajo este objeto global. 
  //     // 'PTLLayouts' es el nombre que le diste al definir el modelo en su archivo.
  //     const LayoutModel = sequelize.models.PTLLayouts;

  //     if (!LayoutModel) {
  //       console.error("⚠️ El modelo 'PTLLayouts' no está registrado en sequelize.models. Revisa cómo se define en su archivo.");
  //       return;
  //     }

  //     const layoutsAfectados = await LayoutModel.findAll({
  //       where: {
  //         layoutData: {
  //           [Op.like]: `%"${codigoWidget}"%`
  //         }
  //       },
  //       transaction: t
  //     });

  //     console.log(`🔍 Se encontraron ${layoutsAfectados.length} usuarios con el widget ${codigoWidget} en su tablero.`);

  //     for (const layout of layoutsAfectados) {
  //       if (layout.layoutData) {
  //         try {
  //           let parsedLayout = JSON.parse(layout.layoutData);

  //           // Filtramos el array para quitar el widget desactivado
  //           parsedLayout = parsedLayout.filter(item => item.codigoWidget !== codigoWidget);

  //           console.log(`👤 Usuario: ${layout.codigoUsuario} | Widgets antes: ${cantidadAntes} | Widgets después: ${parsedLayout.length}`);

  //           await layout.update({
  //             layoutData: JSON.stringify(parsedLayout)
  //           }, { transaction: t });

  //         } catch (error) {
  //           console.error(`Error parseando/limpiando layout del usuario ${layout.codigoUsuario}:`, error);
  //         }
  //       }
  //     }
  //   } catch (errorLayout) {
  //     console.error("⚠️ Error general limpiando layouts:", errorLayout.message);
  //   }
  // }
  // 🟢 Método Helper: Limpieza de la cadena JSON corregido
  async limpiarWidgetDeLayouts(codigoWidget, t) {
    try {
      const LayoutModel = sequelize.models.PTLLayouts;

      if (!LayoutModel) {
        console.error("⚠️ El modelo 'PTLLayouts' no está registrado en sequelize.models.");
        return;
      }

      console.log(`🔍 Buscando layouts afectados por el widget: ${codigoWidget}`);

      const layoutsAfectados = await LayoutModel.findAll({
        where: {
          layoutData: {
            [Op.like]: `%"${codigoWidget}"%`
          }
        },
        transaction: t
      });

      console.log(`🔍 Se encontraron ${layoutsAfectados.length} usuarios con el widget ${codigoWidget} en su tablero.`);

      for (const layout of layoutsAfectados) {
        if (layout.layoutData) {
          try {
            let parsedLayout = JSON.parse(layout.layoutData);

            // Declaramos la cantidad antes de filtrar
            const cantidadAntes = parsedLayout.length;

            // Filtramos el array para quitar el widget desactivado
            parsedLayout = parsedLayout.filter(item => item.codigoWidget !== codigoWidget && item.type !== codigoWidget);

            console.log(`👤 Usuario: ${layout.codigoUsuario} | Widgets antes: ${cantidadAntes} | Widgets después: ${parsedLayout.length}`);

            await layout.update({
              layoutData: JSON.stringify(parsedLayout)
            }, { transaction: t });

            // 🟢 2. EMITIMOS DIRECTAMENTE A LA SALA DEL USUARIO AFECTADO
            // (Asegúrate de que cada usuario al conectarse al socket haga un: socket.join(codigoUsuario))
            io.to(layout.codigoUsuario).emit("layout-actualizado", {
              action: "layout-limpiado",
              codigoWidgetInactivado: codigoWidget,
              nuevoLayout: parsedLayout,
              msg: "Tu tablero se ha actualizado porque un widget fue modificado por administración."
            });

            console.log(`📤 Evento emitido al usuario room: ${layout.codigoUsuario}`);

          } catch (error) {
            console.error(`Error parseando/limpiando layout del usuario ${layout.codigoUsuario}:`, error);
          }
        }
      }
    } catch (errorLayout) {
      console.error("⚠️ Error general limpiando layouts:", errorLayout.message);
    }
  }
}

module.exports = WidgetsService;