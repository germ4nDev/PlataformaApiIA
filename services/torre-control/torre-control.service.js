const { Sequelize } = require('sequelize');
const { sequelize } = require('../../database/connection');
const { BitacoraSincronizacionModel } = require('../../models/torre-control/bitacora-sincronizacion.model');

class TorreControlService {

  constructor() {
    this.model = BitacoraSincronizacionModel(sequelize);
  }

  static async actualizarLayout(codigo, widgets) {
    // Iniciamos una transacción de Sequelize
    const t = await sequelize.transaction();

    try {
      // 1. Opcional: Borrar la configuración anterior de ese código de tablero
      await LayoutModel.destroy({ where: { codigoTablero: codigo }, transaction: t });

      // 2. Mapear los widgets para insertarlos
      const widgetsParaInsertar = widgets.map(w => ({
        codigoTablero: codigo,
        widgetId: w.id,
        config: w.config, // El JSON.stringify({cols, rows})
        posX: w.posicion.x,
        posY: w.posicion.y
      }));

      // 3. Inserción masiva
      await LayoutModel.bulkCreate(widgetsParaInsertar, { transaction: t });

      // Si todo sale bien, confirmamos los cambios
      await t.commit();
      return true;

    } catch (error) {
      // Si algo falla, revertimos la base de datos + error.message
      await t.rollback();
      throw new Error('Error guardando el layout en BD: ');
    }
  }

  async getBitacora() {
    try {
      const logs = await this.model.findAll({
        order: [['fecha_ejecucion', 'DESC']],
        limit: 100
      });

      return {
        success: true,
        statusCode: 200,
        data: logs
      };
    } catch (error) {
      console.error("🔴 Error en TorreControlService (getBitacora):", error);
      throw error;
    }
  }
}

module.exports = new TorreControlService(); // Opcional: exportar la instancia o la clase según uses en el Controller