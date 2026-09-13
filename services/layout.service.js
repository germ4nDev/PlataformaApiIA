/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Security & Transactional Integrity
*/
const { sequelize } = require('../database/connection');
const { LayoutModel, LayoutDTO } = require('../models/layout');

class LayoutService {
  constructor() {
    this.model = LayoutModel(sequelize);
  }

  async getLayoutByUsuario(codigoUsuario) {
    try {
      const layoutDB = await this.model.findOne({
        where: { codigoUsuario }
      });

      if (!layoutDB) {
        // Retornamos null o un objeto vacío controlado si aún no tiene un layout guardado
        return null;
      }

      // Opcional: Parseamos el JSON string de vuelta a objeto para entregarlo limpio al frontend
      const resultado = layoutDB.toJSON();
      try {
        resultado.layoutData = JSON.parse(resultado.layoutData);
      } catch (e) {
        // Si ya era plano se mantiene
      }

      return resultado;
    } catch (error) {
      console.error("Error en LayoutService.getLayoutByUsuario:", error);
      throw error;
    }
  }

  async saveOrUpdateLayout(rawData) {
    const dataDTO = LayoutDTO(rawData);

    return await sequelize.transaction(async (t) => {
      let layoutDB = await this.model.findOne({
        where: { codigoUsuario: dataDTO.codigoUsuario },
        transaction: t
      });

      if (layoutDB) {
        // 🟢 Actualizar si ya existe
        dataDTO.fechaModificacion = new Date().toISOString();
        await this.model.update(dataDTO, {
          where: { codigoUsuario: dataDTO.codigoUsuario },
          transaction: t
        });

        layoutDB = await this.model.findOne({
          where: { codigoUsuario: dataDTO.codigoUsuario },
          transaction: t
        });
      } else {
        // 🟢 Crear si no existe (Upsert lógico)
        layoutDB = await this.model.create(dataDTO, { transaction: t });
      }

      const resultado = layoutDB.toJSON();
      try {
        resultado.layoutData = JSON.parse(resultado.layoutData);
      } catch (e) { }

      return resultado;
    });
  }
}

module.exports = LayoutService;