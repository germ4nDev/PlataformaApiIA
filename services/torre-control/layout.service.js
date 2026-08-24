/*
    Author: German Valencia
    Pattern: QPLUS Service - Gestión del Layout del Tablero (Wipe & Replace)
*/
const { db, sequelize } = require('../../database/connection');
const { LayoutUsuarioDTO, LayoutUsuarioModel } = require('../../models/torre-control/layout-usuario.model');
const { DashboardLayoutModel, DashboardLayoutDTO } = require('../../models/torre-control/dashboardLayout');

class LayoutService {

  async obtenerTablero(codigoUsuario) {
    const ModeloLayout = LayoutUsuarioModel(db.sequelize);

    try {
      // 1. Buscamos el layout personalizado del usuario
      let layoutDB = await ModeloLayout.findAll({
        where: { codigo_usuario: codigoUsuario },
        raw: true
      });

      let esPorDefecto = false;

      // 2. LÓGICA FALLBACK: Si no tiene, traemos el maestro
      if (!layoutDB || layoutDB.length === 0) {
        layoutDB = await ModeloLayout.findAll({
          where: { codigo_usuario: 'SISTEMA_DEFAULT' },
          raw: true
        });
        esPorDefecto = true;
      }

      // 3. Traductor Inverso: De SQL Server al formato que Gridster y Angular entienden
      const layoutAngular = layoutDB.map(row => {
        const widgetConfig = {
          x: row.pos_x,
          y: row.pos_y,
          cols: row.cols,
          rows: row.rows,
          type: row.codigo_widget,
          visible: row.visible
        };

        // Si es una instancia (como un Terminal), reconstruimos el objeto 'data'
        if (row.instancia !== 'UNICA') {
          widgetConfig.data = { nombreTerminal: row.instancia };
        }

        return widgetConfig;
      });

      return {
        success: true,
        esLayoutPorDefecto: esPorDefecto,
        data: layoutAngular
      };

    } catch (error) {
      console.error("❌ [LAYOUT-SERVICE] Error obteniendo tablero:", error);
      throw new Error('Error al consultar el layout del usuario');
    }
  }

  // async obtenerTableroUsuario(codigoUsuario, tablero) {
  //   const Modelolayout = DashboardLayoutModel(db.sequelize);
  //   let layoutDB = [];
  //   layoutDB = await Modelolayout.findAll({
  //     where: { codigoUsuario: codigoUsuario, codigoDashboard: tablero },
  //     raw: true
  //   });
  //   console.log('⚠️ Resultado de búsqueda:', JSON.stringify(layoutDB, null, 2));
  //   if (!layoutDB || layoutDB.length === 0) {
  //     console.log(`⚠️ Usuario ${codigoUsuario} sin layout. Cargando SISTEMA_DEFAULT...`);
  //     layoutDB = await Modelolayout.findAll({
  //       where: { codigoUsuario: 'SISTEMA_DEFAULT', codigoDashboard: tablero },
  //       raw: true
  //     });
  //   }
  //   console.log('⚠️ Resultado de búsqueda:', JSON.stringify(layoutDB, null, 2));
  //   return layoutDB.map(row => {
  //     let conf = {};
  //     try {
  //       conf = typeof row.config === 'string' ? JSON.parse(row.config) : (row.config || {});
  //     } catch (e) { conf = { cols: 4, rows: 4 }; }

  //     return {
  //       x: row.posicion_x,
  //       y: row.posicion_y,
  //       cols: conf.cols || 4,
  //       rows: conf.rows || 4,
  //       type: row.widget_id,
  //       visible: true
  //     };
  //   });
  // }
  // async obtenerTableroUsuario(codigoUsuario, tablero) {
  //   const Modelolayout = DashboardLayoutModel(db.sequelize);
  //   // 1. Intentar buscar el layout del usuario
  //   let layoutDB = await Modelolayout.findAll({
  //     where: { codigoUsuario: codigoUsuario, codigoDashboard: tablero },
  //     raw: true
  //   });

  //   // 2. Fallback al SISTEMA_DEFAULT si no hay nada
  //   if (!layoutDB || layoutDB.length === 0) {
  //     layoutDB = await Modelolayout.findAll({
  //       where: { codigoUsuario: 'SISTEMA_DEFAULT', codigoDashboard: tablero },
  //       raw: true
  //     });
  //   }

  //   // 3. NORMALIZACIÓN (Aquí ocurre la magia)
  //   // Convertimos lo que sea que trajo la DB (sea usuario o default)
  //   // al formato estándar que Angular espera.
  //   const widgetsFormateados = layoutDB.map(row => {
  //     let conf = typeof row.config === 'string' ? JSON.parse(row.config) : (row.config || {});
  //     return {
  //       x: row.posicion_x,
  //       y: row.posicion_y,
  //       data: { nombreTerminal: row.widget_id },
  //       cols: conf.cols || 4,
  //       rows: conf.rows || 4,
  //       type: row.widget_id,
  //       visible: true
  //     };
  //   });

  //   // 4. RETORNO UNIFICADO
  //   // El frontend NO sabe si esto vino de 'SISTEMA_DEFAULT' o del usuario.
  //   // Solo sabe que recibe un objeto con 'data'.
  //   return {
  //     success: true,
  //     data: widgetsFormateados,
  //     esLayoutPorDefecto: false
  //   };
  // }
  async obtenerTableroUsuario(codigoUsuario, tablero) {
    const ModeloLayout = LayoutUsuarioModel(db.sequelize);

    try {
      // 1. Buscamos el layout personalizado del usuario
      let layoutDB = await ModeloLayout.findAll({
        where: { codigo_usuario: codigoUsuario, codigoDashboard: tablero },
        raw: true
      });

      let esPorDefecto = false;

      // 2. LÓGICA FALLBACK: Si no tiene, traemos el maestro
      if (!layoutDB || layoutDB.length === 0) {
        layoutDB = await ModeloLayout.findAll({
          where: { codigo_usuario: 'SISTEMA_DEFAULT', codigoDashboard: tablero },
          raw: true
        });
        esPorDefecto = true;
      }

      // 3. Traductor Inverso: De SQL Server al formato que Gridster y Angular entienden
      const layoutAngular = layoutDB.map(row => {
        const widgetConfig = {
          x: row.pos_x,
          y: row.pos_y,
          cols: row.cols,
          rows: row.rows,
          type: row.codigo_widget,
          visible: row.visible
        };

        // Si es una instancia (como un Terminal), reconstruimos el objeto 'data'
        if (row.instancia !== 'UNICA') {
          widgetConfig.data = { nombreTerminal: row.instancia };
        }

        return widgetConfig;
      });

      return {
        success: true,
        esLayoutPorDefecto: esPorDefecto,
        data: layoutAngular
      };

    } catch (error) {
      console.error("❌ [LAYOUT-SERVICE] Error obteniendo tablero:", error);
      throw new Error('Error al consultar el layout del usuario');
    }
  }

  async guardarTablero(codigoUsuario, layoutArray) {
    // 1. Inicialización en tiempo de ejecución: 
    // Garantizamos que el modelo existe y está conectado a la instancia activa de sequelize
    const ModeloLayout = LayoutUsuarioModel(db.sequelize);

    // 2. Iniciamos la transacción para asegurar atomicidad
    const transaction = await db.sequelize.transaction();

    try {
      // 3. Mapeo y saneamiento de datos
      const layoutProcesado = layoutArray.map(item => {
        // Extraemos la instancia (ej. el nombre del terminal) o usamos 'UNICA'
        const nombreInstancia = item.data?.nombreTerminal || item.instancia || 'UNICA';

        return LayoutUsuarioDTO({
          codigo_usuario: codigoUsuario,
          codigo_widget: (item.type || item.codigo_widget).toUpperCase(),
          instancia: nombreInstancia.toUpperCase(),
          pos_x: item.x !== undefined ? item.x : item.pos_x,
          pos_y: item.y !== undefined ? item.y : item.pos_y,
          cols: item.cols,
          rows: item.rows,
          visible: item.visible !== undefined ? item.visible : true
        }, { codigoUsuario: codigoUsuario });
      });

      // 4. PATRÓN WIPE & REPLACE
      // Eliminamos solo lo que pertenece al usuario actual antes de insertar la nueva configuración
      await ModeloLayout.destroy({
        where: { codigo_usuario: codigoUsuario },
        transaction
      });

      // 5. Inserción masiva de la nueva configuración
      await ModeloLayout.bulkCreate(layoutProcesado, {
        transaction
      });

      // 6. Si todo sale bien, confirmamos los cambios
      await transaction.commit();

      return {
        success: true,
        message: 'Tablero guardado exitosamente',
        widgetsGuardados: layoutProcesado.length
      };

    } catch (error) {
      // Si algo falla, revertimos toda la operación (ni borrado ni inserción)
      await transaction.rollback();
      // Lanzamos error personalizado
      throw {
        type: 'DatabaseError',
        message: 'Error al persistir la configuración en BD',
        details: error.message
      };
    }
  }
}

module.exports = new LayoutService();