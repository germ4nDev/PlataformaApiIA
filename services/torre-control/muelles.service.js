/*
    Author: German Valencia
    Refactored for: PORTTOS Standard (Clean Service Layer) - Catálogo de Widgets
*/
const { Sequelize } = require('sequelize');
const { sequelize } = require('../../database/connection');
const { MuelleModel, MuelleDTO } = require('../../models/torre-control/muelle.model.js');
const { wrapToFeatureCollection } = require('../../utils/geoJsonHelper.js');
const { io } = require('../../index');

class MuellesService {
  constructor() {
    this.model = MuelleModel(sequelize);
  }

  _parseWktPolygon(wkt) {
    if (!wkt) return null;
    const match = wkt.match(/POLYGON\s*\(\((.+)\)\)/);
    if (!match) return null;

    const coordsStr = match[1]; // "-74.95 10.95, -74.7 10.95..."
    const coordinates = coordsStr.split(',').map(pair => {
      return pair.trim().split(' ').map(Number);
    });

    return { type: 'Polygon', coordinates: [coordinates] };
  }

  _mapearRegistro(MuelleInstancia) {
    const p = MuelleInstancia.get({ plain: true });
    const polygonGeometry = this._parseWktPolygon(p.geocerca_text);

    return {
      ...p,
      geocerca_geo: wrapToFeatureCollection(polygonGeometry),
      geocerca_text: undefined
    };
  }

  async getMuelles() {
    try {
      const registros = await this.model.findAll({
        attributes: {
          include: [
            [Sequelize.literal('geocerca_geo.STAsText()'), 'geocerca_text']
          ]
        }
      });

      return {
        ok: true,
        data: registros.map(p => this._mapearRegistro(p)),
        statusCode: 200
      };
    } catch (error) {
      console.error("🔴 Error en MuellesService (getMuelles):", error);
      throw error;
    }
  }

  async getMuelleById(id_interno) {
    try {
      const muelle = await this.model.findOne({
        where: { id_interno: id_interno }, // 🐛 Variable corregida
        attributes: {
          include: [
            [Sequelize.literal('geocerca_geo.STAsText()'), 'geocerca_text']
          ]
        }
      });

      if (!muelle) return { ok: false, statusCode: 404 };

      return {
        ok: true,
        data: this._mapearRegistro(muelle),
        statusCode: 200
      };
    } catch (error) {
      console.error("🔴 Error en MuellesService (getMuelleById):", error);
      throw error;
    }
  }

  async crearMuelle(rawData, userContext = { codigoUsuario: 'SISTEMA_ADMIN' }) {
    try {
      const dataDTO = MuelleDTO(rawData, userContext);

      if (dataDTO.geocerca_geo) {
        dataDTO.geocerca_geo = Sequelize.literal(`geometry::STGeomFromText('${dataDTO.geocerca_geo}', 4326)`);
      }

      return await sequelize.transaction(async (t) => {
        const nuevoMuelle = await this.model.create(dataDTO, { transaction: t });

        if (typeof io !== 'undefined') {
          io.emit('muelles-actualizados', { action: 'create', msg: `Nuevo muelle registrado: ${nuevoMuelle.codigo_muelle}` });
        }
        return nuevoMuelle;
      });
    } catch (error) {
      console.error('🔴 Error COMPLETO en crearMuelle:', error);
      throw error;
    }
  }

  async updateMuelle(id_interno, rawData, userContext = { codigoUsuario: 'SISTEMA_ADMIN' }) {
    try {
      const dataDTO = MuelleDTO(rawData, userContext);

      if (dataDTO.geocerca_geo) {
        dataDTO.geocerca_geo = Sequelize.literal(`geometry::STGeomFromText('${dataDTO.geocerca_geo}', 4326)`);
      }

      return await sequelize.transaction(async (t) => {
        const dbMuelle = await this.model.findOne({ where: { id_interno }, transaction: t });
        if (!dbMuelle) throw { statusCode: 404, msg: "No existe el muelle para actualizar." };

        await this.model.update(dataDTO, { where: { id_interno }, transaction: t });

        const actualizado = await this.model.findOne({
          where: { id_interno },
          transaction: t,
          attributes: {
            include: [
              [Sequelize.literal('geocerca_geo.STAsText()'), 'geocerca_text']
            ]
          }
        });

        if (typeof io !== 'undefined') io.emit('muelles-actualizados', { action: 'update' });

        return this._mapearRegistro(actualizado);
      });
    } catch (error) {
      console.error("🔴 Error en updateMuelle:", error);
      throw error;
    }
  }

  async deleteMuelle(id_muelle) {
    try {
      return await sequelize.transaction(async (t) => {
        const dbMuelle = await this.model.findOne({ where: { id_interno: id_muelle }, transaction: t });
        if (!dbMuelle) throw { statusCode: 404, msg: "No existe un muelle con ese id." };

        await this.model.destroy({ where: { id_interno: id_muelle }, transaction: t });

        if (typeof io !== 'undefined') {
          io.emit('muelles-actualizados', { action: 'delete', msg: `Muelle eliminado: ${dbMuelle.codigo_muelle}` });
        }
        return dbMuelle;
      });
    } catch (error) {
      console.error(`🔴 Error en deleteMuelle (Rollback):`, error.msg || error.message);
      throw error;
    }
  }
}

module.exports = MuellesService;