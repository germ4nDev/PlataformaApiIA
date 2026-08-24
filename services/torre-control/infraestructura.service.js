/*
    Author: German Valencia
    Pattern: QPLUS Architecture - Servicio de Infraestructura
    Update: Unificación de campos espaciales (Point y Polygon) y GeoJSON Enveloping
*/
const { Sequelize } = require('sequelize');
const { sequelize } = require('../../database/connection');
const { InfraestructuraModel, InfraestructuraDTO } = require('../../models/torre-control/infraestructura.model.js');
const { wrapToFeatureCollection } = require('../../utils/geoJsonHelper.js');
const { io } = require('../../index');

class InfraestructuraService {
  constructor() {
    this.model = InfraestructuraModel(sequelize);
  }

  // 1. Parsers para convertir WKT a GeoJSON Geometry puro
  _parseWktPoint(wkt) {
    if (!wkt) return null;
    const match = wkt.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/);
    if (!match) return null;

    return {
      type: 'Point',
      coordinates: [parseFloat(match[1]), parseFloat(match[2])] // [lon, lat]
    };
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

  // 2. Mapeo para Angular (El viaje de Vuelta)
  _mapearRegistro(instancia) {
    // Obtenemos los datos limpios de Sequelize
    const i = instancia.get({ plain: true });

    // Extraemos las geometrías puras de los strings devueltos por SQL Server
    const pointGeometry = this._parseWktPoint(i.ubicacion_text);
    const polygonGeometry = this._parseWktPolygon(i.geocerca_text);

    return {
      ...i,
      // Envolvemos las geometrías en un FeatureCollection para Mapbox Draw
      ubicacion_geo: wrapToFeatureCollection(pointGeometry),
      geocerca_geo: wrapToFeatureCollection(polygonGeometry),

      // Limpiamos los campos temporales de texto
      ubicacion_text: undefined,
      geocerca_text: undefined
    };
  }

  _geoJsonToWkt(geoJson) {
    if (!geoJson) return null;

    if (geoJson.type === 'Point') {
      const [lon, lat] = geoJson.coordinates;
      // CAST es una instrucción core de SQL, 100% a prueba de fallos de driver
      return Sequelize.literal(`CAST('POINT(${lon} ${lat})' AS geometry)`);
    }

    if (geoJson.type === 'Polygon') {
      // Formateo del array de coordenadas para WKT
      const coordsStr = geoJson.coordinates[0].map(c => `${c[0]} ${c[1]}`).join(', ');
      return Sequelize.literal(`CAST('POLYGON((${coordsStr}))' AS geometry)`);
    }

    return null;
  }

  // 3. CRUD de Lectura
  async getInfraestructuras() {
    try {
      const registros = await this.model.findAll({
        attributes: {
          include: [
            [Sequelize.literal('ubicacion_geo.STAsText()'), 'ubicacion_text'],
            [Sequelize.literal('geocerca_geo.STAsText()'), 'geocerca_text']
          ]
        }
      });

      return {
        ok: true,
        data: registros.map(i => this._mapearRegistro(i)),
        statusCode: 200
      };
    } catch (error) {
      console.error("Error en getInfraestructuras:", error);
      throw error;
    }
  }

  async getInfraestructuraById(id) {
    try {
      const infra = await this.model.findOne({
        where: { id_infraestructura: id },
        attributes: {
          include: [
            [Sequelize.literal('ubicacion_geo.STAsText()'), 'ubicacion_text'],
            [Sequelize.literal('geocerca_geo.STAsText()'), 'geocerca_text']
          ]
        }
      });

      if (!infra) return { ok: false, statusCode: 404 };

      return {
        ok: true,
        data: this._mapearRegistro(infra),
        statusCode: 200
      };
    } catch (error) {
      console.error("Error en getInfraestructuraById:", error);
      throw error;
    }
  }



  // 4. CRUD de Escritura (Usa el patrón DTO QPLUS)
  async crearInfraestructura(rawData, userContext = { codigoUsuario: 'SISTEMA_ADMIN' }) {
    try {
      const dataDTO = InfraestructuraDTO(rawData, userContext);

      // Mutamos el payload inyectando el SQL puro antes de pasarlo al modelo
      const payload = { ...dataDTO };
      if (payload.ubicacion_geo) payload.ubicacion_geo = this._geoJsonToWkt(payload.ubicacion_geo);
      if (payload.geocerca_geo) payload.geocerca_geo = this._geoJsonToWkt(payload.geocerca_geo);

      return await sequelize.transaction(async (t) => {
        const nuevaInfra = await this.model.create(payload, { transaction: t });

        if (typeof io !== 'undefined') {
          io.emit('infraestructura-actualizada', { action: 'create' });
        }

        return nuevaInfra;
      });
    } catch (error) {
      throw error;
    }
  }

  // async updateInfraestructura(id_infraestructura, rawData, userContext = { codigoUsuario: 'SISTEMA_ADMIN' }) {
  //   try {

  //     const dataDTO = InfraestructuraDTO(rawData, userContext);
  //     console.log('datos', dataDTO);

  //     // Mutamos el payload inyectando el SQL puro antes de pasarlo al modelo
  //     const payload = { ...dataDTO };
  //     if (payload.ubicacion_geo) payload.ubicacion_geo = this._geoJsonToWkt(payload.ubicacion_geo);
  //     if (payload.geocerca_geo) payload.geocerca_geo = this._geoJsonToWkt(payload.geocerca_geo);

  //     return await sequelize.transaction(async (t) => {
  //       await this.model.update(payload, {
  //         where: { id_infraestructura },
  //         transaction: t
  //       });

  //       const actualizado = await this.model.findOne({
  //         where: { id_infraestructura },
  //         transaction: t,
  //         attributes: {
  //           include: [
  //             [Sequelize.literal('ubicacion_geo.STAsText()'), 'ubicacion_text'],
  //             [Sequelize.literal('geocerca_geo.STAsText()'), 'geocerca_text']
  //           ]
  //         }
  //       });

  //       if (typeof io !== 'undefined') {
  //         io.emit('infraestructura-actualizada', { action: 'update' });
  //       }

  //       return actualizado;
  //     });
  //   } catch (error) {
  //     throw error;
  //   }
  // }
  async updateInfraestructura(id_infraestructura, rawData, userContext = { codigoUsuario: 'SISTEMA_ADMIN' }) {
    try {
      // 1. Pasa por el DTO (Esto genera el objeto "datos" que ves en tu consola)
      const dataDTO = InfraestructuraDTO(rawData, userContext);

      const payload = { ...dataDTO };

      // 2. LA MAGIA: Convertimos el objeto GeoJSON en texto SQL puro ANTES del update
      // Si no hacemos esto, Sequelize intentará procesar el objeto y hará Rollback automático.
      if (payload.ubicacion_geo) {
        payload.ubicacion_geo = this._geoJsonToWkt(payload.ubicacion_geo);
      }
      if (payload.geocerca_geo) {
        payload.geocerca_geo = this._geoJsonToWkt(payload.geocerca_geo);
      }
      if (payload.fecha_cargue && typeof payload.fecha_cargue === 'object') {
        payload.fecha_cargue = payload.fecha_cargue.toISOString();
      }

      console.log("Payload mutado listo para Sequelize:", payload); // <-- Revisa esto en consola

      // 3. Ejecutar la transacción
      return await sequelize.transaction(async (t) => {
        await this.model.update(payload, {
          where: { id_infraestructura },
          transaction: t
        });

        // 4. Retornar los datos actualizados...
        const actualizado = await this.model.findOne({
          where: { id_infraestructura },
          transaction: t,
          attributes: {
            include: [
              [Sequelize.literal('ubicacion_geo.STAsText()'), 'ubicacion_text'],
              [Sequelize.literal('geocerca_geo.STAsText()'), 'geocerca_text']
            ]
          }
        });

        if (typeof io !== 'undefined') {
          io.emit('infraestructura-actualizada', { action: 'update' });
        }

        return actualizado;
      });
    } catch (error) {
      // CONSEJO CLAVE: Imprime el error para no "volar a ciegas"
      console.error('Error detallado en updateInfraestructura:', error);
      throw error;
    }
  }

  async deleteInfraestructura(id_infraestructura) {
    try {
      return await sequelize.transaction(async (t) => {
        await this.model.destroy({
          where: { id_infraestructura },
          transaction: t
        });

        if (typeof io !== 'undefined') {
          io.emit('infraestructura-actualizada', { action: 'delete' });
        }

        return { success: true };
      });
    } catch (error) {
      throw error;
    }
  }
}

module.exports = InfraestructuraService;