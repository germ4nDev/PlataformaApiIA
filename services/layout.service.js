/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Security & Transactional Integrity
*/
const { sequelize } = require('../database/connection');
const { LayoutModel, LayoutDTO } = require('../models/layout');
// Asegúrate de importar el modelo y DTO de pestañas que creamos antes
const { LayoutPestanaModel, LayoutPestanaDTO } = require('../models/layoiutr-pestana.model');

class LayoutService {
  constructor() {
    // 🚨 Instanciamos ambos modelos para tenerlos disponibles en la clase
    this.layoutModel = LayoutModel(sequelize);
    this.pestanaModel = LayoutPestanaModel(sequelize);
  }

  // ==========================================
  // WIDGETS (LAYOUTS)
  // ==========================================
  async getLayouts() {
    try {
      const layoutDB = await this.layoutModel.findAll();

      if (!layoutDB || layoutDB.length === 0) return [];

      return layoutDB.map(registro => {
        const widget = registro.toJSON();
        if (widget.config) {
          try { widget.config = JSON.parse(widget.config); }
          catch (e) { console.error("Error parseando config del widget", widget.codigoWidget); }
        }
        return widget;
      });
    } catch (error) {
      console.error("Error en LayoutService.getLayouts:", error);
      throw error;
    }
  }

  async getLayoutByUsuario(codigoUsuario, codigoPestana) {
    try {
      const layoutDB = await this.layoutModel.findAll({
        where: { codigoUsuario, codigoPestana }
      });

      if (!layoutDB || layoutDB.length === 0) return [];

      return layoutDB.map(registro => {
        const widget = registro.toJSON();
        if (widget.config) {
          try { widget.config = JSON.parse(widget.config); }
          catch (e) { console.error("Error parseando config del widget", widget.codigoWidget); }
        }
        return widget;
      });
    } catch (error) {
      console.error("Error en LayoutService.getLayoutByUsuario:", error);
      throw error;
    }
  }

  async saveLayout(rawDataArray) {
    console.log('dataDTOs a guardar', rawDataArray);

    // Si viene vacío o no es array, abortamos limpiamente
    if (!Array.isArray(rawDataArray) || rawDataArray.length === 0) return [];

    const dataDTOs = rawDataArray.map(widgetRaw => LayoutDTO(widgetRaw));
    const { codigoUsuario, codigoPestana } = dataDTOs[0];

    return await sequelize.transaction(async (t) => {
      await this.layoutModel.destroy({
        where: { codigoUsuario, codigoPestana },
        transaction: t
      });

      const layoutDB = await this.layoutModel.bulkCreate(dataDTOs, { transaction: t });

      return layoutDB.map(registro => {
        const widget = registro.toJSON();
        if (widget.config) {
          try { widget.config = JSON.parse(widget.config); }
          catch (e) { }
        }
        return widget;
      });
    });
  }

  // ==========================================
  // PESTAÑAS (TABS)
  // ==========================================
  async getPestanasByUsuario(codigoUsuario) {
    try {
      // Retornamos las pestañas ordenadas por la columna 'posicion'
      return await this.pestanaModel.findAll({
        where: { codigoUsuario },
        order: [['posicion', 'ASC']]
      });
    } catch (error) {
      console.error("Error en LayoutService.getPestanasByUsuario:", error);
      throw error;
    }
  }

  async savePestanasUsuario(pestanasArray) {
    if (!Array.isArray(pestanasArray) || pestanasArray.length === 0) return [];

    // Pasamos todo por el DTO para estandarizar y validar
    const dataDTOs = pestanasArray.map(pestana => LayoutPestanaDTO(pestana));
    const { codigoUsuario } = dataDTOs[0];

    return await sequelize.transaction(async (t) => {
      // 1. Borramos la configuración anterior
      await this.pestanaModel.destroy({
        where: { codigoUsuario },
        transaction: t
      });

      // 2. Insertamos la nueva (con sus posiciones ordenadas)
      return await this.pestanaModel.bulkCreate(dataDTOs, { transaction: t });
    });
  }
}

module.exports = LayoutService;