// services/torre-control/evento-vial.service.js
const db = require('../../models');
const { Op } = require('sequelize');

const EventoVial = db.EventoVial;
const sequelize = db.sequelize;

class EventoVialService {

  // async obtenerEventosActi vosGeoJSON() {
  //   try {
  //     // 1. Obtener el string de la fecha de hoy en formato 'YYYY-MM-DD'
  //     // Restamos el TimezoneOffset para asegurar que tome la fecha local (ej. Colombia) y no salte de día por el UTC del servidor Node
  //     const tzoffset = (new Date()).getTimezoneOffset() * 60000;
  //     const hoyString = (new Date(Date.now() - tzoffset)).toISOString().split('T')[0];

  //     // 2. Consultar todos los eventos activos en BD
  //     const eventos = await EventoVial.findAll({
  //       where: {
  //         estadoEvento: 'ACTIVO',
  //         // 👈 MAGIA AQUÍ: Compara SOLO la fecha ignorando la hora
  //         // Equivalente en SQL: CAST(fechaInicio AS DATE) = 'YYYY-MM-DD'
  //         [Op.and]: [
  //           sequelize.where(sequelize.cast(sequelize.col('fechaInicio'), 'DATE'), hoyString)
  //         ]
  //       },
  //       attributes: [
  //         'codigoEvento', 'corredorVial', 'sector', 'tipoEvento',
  //         'descripcion', 'nivelSeveridad', 'fechaInicio',
  //         // Extracción de coordenadas desde SQL Server
  //         [sequelize.literal('ubicacion_geo.STX'), 'lon'],
  //         [sequelize.literal('ubicacion_geo.STY'), 'lat']
  //       ]
  //     });

  //     // 3. Ensamblar el FeatureCollection (GeoJSON)
  //     const features = eventos
  //       .filter(evento => evento.dataValues.lon && evento.dataValues.lat) // Solo los que tengan coordenadas
  //       .map(evento => {
  //         return {
  //           type: 'Feature',
  //           geometry: {
  //             type: 'Point',
  //             coordinates: [evento.dataValues.lon, evento.dataValues.lat]
  //           },
  //           properties: {
  //             id: evento.codigoEvento,
  //             corredor: evento.corredorVial,
  //             sector: evento.sector,
  //             tipoEvento: evento.tipoEvento,
  //             descripcion: evento.descripcion,
  //             nivelSeveridad: evento.nivelSeveridad,
  //             fechaInicio: evento.fechaInicio
  //           }
  //         };
  //       });

  //     return {
  //       type: 'FeatureCollection',
  //       features: features
  //     };

  //   } catch (error) {
  //     console.error("❌ Error al obtener eventos viales:", error);
  //     throw error;
  //   }
  // }
  async obtenerEventosActivosGeoJSON() {
    try {
      // 1. Consultar en BD TODOS los eventos que sigan activos
      // (Ignoramos la fecha de creación, nos importa el estado actual)
      const eventos = await EventoVial.findAll({
        where: {
          estadoEvento: 'ACTIVO'
        },
        attributes: [
          'codigoEvento', 'corredorVial', 'sector', 'tipoEvento',
          'descripcion', 'nivelSeveridad', 'fechaInicio',
          // Extracción de coordenadas crudas desde SQL Server (Tipos de dato Geometry)
          [sequelize.literal('ubicacion_geo.STX'), 'lon'],
          [sequelize.literal('ubicacion_geo.STY'), 'lat']
        ]
      });

      // 2. Transformar a estándar GeoJSON para Mapbox/MapLibre
      const features = eventos
        // Filtro de seguridad vital: Descartar si por error se guardó sin coordenadas
        .filter(evento => evento.dataValues.lon != null && evento.dataValues.lat != null)
        .map(evento => {
          return {
            type: 'Feature',
            geometry: {
              type: 'Point',
              // Mapbox espera el orden [Longitud, Latitud]
              coordinates: [evento.dataValues.lon, evento.dataValues.lat]
            },
            properties: {
              id: evento.codigoEvento,
              corredor: evento.corredorVial,
              sector: evento.sector,
              tipoEvento: evento.tipoEvento,
              descripcion: evento.descripcion,
              nivelSeveridad: evento.nivelSeveridad,
              fechaInicio: evento.fechaInicio
            }
          };
        });

      // 3. Entregar paquete final a Angular
      return {
        type: 'FeatureCollection',
        features: features
      };

    } catch (error) {
      console.error("❌ Error en EventoVialService al generar GeoJSON:", error);
      throw error;
    }
  }
}

module.exports = new EventoVialService();