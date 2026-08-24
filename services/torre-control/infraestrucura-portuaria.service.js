/*
    Author: German Valencia
    Refactored for: QPLUS Standard (Clean Service Layer) + Spatial Geometry
*/
const { sequelize } = require('../../database/connection');
const { InfraestructuraModel, InfraestructuraDTO } = require('../../models/torre-control/infraestructura.model');
const { io } = require('../../index');
const { Sequelize } = require('sequelize');

class InfraestructuraPortuariaService {
  constructor() {
    this.model = InfraestructuraModel(sequelize);
  }

  // 1. Obtener todos (con conversión espacial)
  async getInfraestructuras() {
    try {
      const resultados = await this.model.findAll({
        attributes: {
          exclude: ['geocerca_geo'], // 1. EXCLUIMOS el campo binario que causa el "Buffer"
          include: [
            [sequelize.literal('geocerca_geo.STAsText()'), 'geocerca_wkt'] // 2. INCLUIMOS la conversión a texto
          ]
        }
      });
      return { ok: true, data: resultados, statusCode: 200 };
    } catch (error) {
      console.error("🔴 Error en InfraestructurasService (getInfraestructuras):", error);
      throw error;
    }
  }

  // 2. Obtener por Terminal (Corregido: sintaxis de where)
  async getInfraestructurasByIdTerminal(id_terminal) {
    try {
      const resultados = await this.model.findAll({
        where: { id_terminal },
        attributes: {
          include: [[sequelize.fn('STAsText', sequelize.col('geocerca_geo')), 'geocerca_wkt']]
        }
      });
      return { ok: true, data: resultados, statusCode: 200 };
    } catch (error) {
      console.error("🔴 Error en InfraestructurasService (getInfraestructurasByIdTerminal):", error);
      throw error;
    }
  }

  // 3. Obtener por ID
  async getInfraestructuraById(id_infraestructura) {
    try {
      const registro = await this.model.findOne({
        where: { id_infraestructura },
        attributes: {
          include: [[sequelize.fn('STAsText', sequelize.col('geocerca_geo')), 'geocerca_wkt']]
        }
      });
      if (!registro) throw { statusCode: 404, msg: "No existe la infraestructura con ese Id." };
      return registro;
    } catch (error) {
      console.error("🔴 Error en InfraestructurasService (getInfraestructuraById):", error);
      throw error;
    }
  }

  // 4. Crear (El DTO maneja la transformación a GeoJSON)
  async crearInfraestructura(rawData, userContext = { codigoUsuario: 'SISTEMA_ADMIN' }) {
    try {
      const dataDTO = InfraestructuraDTO(rawData, userContext);

      // Sequelize detecta 'geocerca_geo' (Geometry) y lo convierte solo al hacer el create
      return await sequelize.transaction(async (t) => {
        const nuevo = await this.model.create(dataDTO, { transaction: t });

        if (io) io.emit('infraestructuras-actualizados', { action: 'create', msg: `Nuevo muelle: ${nuevo.nombre}` });
        return nuevo;
      });
    } catch (error) {
      console.error('🔴 Error en crearInfraestructura:', error);
      throw error;
    }
  }

  // 5. Actualizar
  async updateInfraestructura(id_infraestructura, rawData, userContext = { codigoUsuario: 'SISTEMA_ADMIN' }) {
    try {
      const dataDTO = InfraestructuraDTO(rawData, userContext);

      return await sequelize.transaction(async (t) => {
        const actualizado = await this.model.update(dataDTO, {
          where: { id_infraestructura },
          transaction: t
        });

        // Emitir evento
        if (io) io.emit('infraestructuras-actualizados', { action: 'update', msg: `Infraestructura actualizada: ${dataDTO.nombre}` });
        return actualizado;
      });
    } catch (error) {
      console.error(`🔴 Error en updateInfraestructura:`, error);
      throw error;
    }
  }

  // 6. Delete
  async deleteInfraestructura(id_infraestructura) {
    try {
      return await sequelize.transaction(async (t) => {
        const dbInfraestructura = await this.model.findOne({ where: { id_infraestructura }, transaction: t });
        if (!dbInfraestructura) throw { statusCode: 404, msg: "No existe la infraestructura." };

        await this.model.destroy({ where: { id_infraestructura }, transaction: t });
        if (io) io.emit('infraestructuras-actualizados', { action: 'delete', msg: `Infraestructura eliminada` });

        return dbInfraestructura;
      });
    } catch (error) {
      console.error(`🔴 Error en deleteInfraestructura:`, error);
      throw error;
    }
  }
}

module.exports = InfraestructuraPortuariaService;