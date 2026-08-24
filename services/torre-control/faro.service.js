// /*
//     Author: German Valencia
//     Pattern: Service Layer - Maestro de Faros
//     Description: Servicio para la gestión unificada de peajes, geocercas terrestres y zonas marítimas.
//     Update: Estandarización de columna geocerca_geo y métodos en inglés para el Controller.
// */
// const { FaroModel } = require('../../models/torre-control/faro.model'); // Ajusta tu ruta
// const { Sequelize } = require('sequelize');
// const { sequelize } = require('../../database/connection'); // Ajusta tu ruta
// const parseWKT = require('wellknown');

// const Faro = FaroModel(sequelize);

// /**
//  * HELPER: Envuelve una geometría cruda (Polygon, Point, etc.) 
//  * en un objeto FeatureCollection estándar de GeoJSON.
//  */
// const wrapToFeatureCollection = (geometry, properties = {}) => {
//   if (!geometry) return null;
//   return {
//     type: 'FeatureCollection',
//     features: [
//       {
//         type: 'Feature',
//         geometry: geometry,
//         properties: properties
//       }
//     ]
//   };
// };

// const faroService = {

//   crearFaro: async (faroData, userContext) => {
//     // 🟢 CORRECCIÓN: Usamos geocerca_geo consistentemente
//     if (faroData.geocerca_geo) {
//       faroData.geocerca_geo = sequelize.literal(
//         `geometry::STGeomFromText('${faroData.geocerca_geo}', 4326)`
//       );
//     }

//     const nuevoFaro = await Faro.create(faroData);
//     return nuevoFaro;
//   },

//   // 🟢 Renombrado a getFaros para coincidir con el controlador
//   obtenerFaros: async () => {
//     const faros = await Faro.findAll({
//       where: { estado: true },
//       attributes: {
//         include: [[sequelize.literal('geocerca_geo.STAsText()'), 'geocerca_geo_wkt']]
//       }
//     });

//     const farosData = faros.map(faro => {
//       const faroJSON = faro.toJSON();

//       if (faroJSON.geocerca_geo_wkt) {
//         const rawGeometry = parseWKT(faroJSON.geocerca_geo_wkt);
//         faroJSON.geocerca_geo = wrapToFeatureCollection(rawGeometry, {
//           id_faro: faroJSON.id_faro,
//           nombre_faro: faroJSON.nombre_faro,
//           color_ui: faroJSON.color_ui,
//           tipo_faro: faroJSON.tipo_faro,
//           descripcion: faroJSON.descripcion,
//           genera_alerta_toast: faroJSON.genera_alerta_toast
//         });
//       } else {
//         faroJSON.geocerca_geo = null;
//       }

//       delete faroJSON.geocerca_geo_wkt;
//       return faroJSON;
//     });

//     // 🟢 El controlador espera que retornes un objeto con statusCode, ok, y data
//     return { statusCode: 200, ok: true, data: farosData };
//   },

//   // 🟢 Renombrado a getFaroById
//   obtenerFaroPorId: async (id_faro) => {
//     const faro = await Faro.findByPk(id_faro, {
//       attributes: {
//         // 🟢 CORRECCIÓN: Usamos geocerca_geo y su alias geocerca_geo_wkt
//         include: [[sequelize.literal('geocerca_geo.STAsText()'), 'geocerca_geo_wkt']]
//       }
//     });

//     if (!faro) {
//       return { statusCode: 404, ok: false, data: null };
//     }

//     const faroJSON = faro.toJSON();

//     if (faroJSON.geocerca_geo_wkt) {
//       const rawGeometry = parseWKT(faroJSON.geocerca_geo_wkt);
//       faroJSON.geocerca_geo = wrapToFeatureCollection(rawGeometry, {
//         id_faro: faroJSON.id_faro,
//         nombre_faro: faroJSON.nombre_faro,
//         color_ui: faroJSON.color_ui,
//         tipo_faro: faroJSON.tipo_faro,
//         descripcion: faroJSON.descripcion,
//         genera_alerta_toast: faroJSON.genera_alerta_toast
//       });
//     } else {
//       faroJSON.geocerca_geo = null;
//     }

//     delete faroJSON.geocerca_geo_wkt;

//     return { statusCode: 200, ok: true, data: faroJSON };
//   },

//   // 🟢 Renombrado a updateFaro
//   actualizarFaro: async (id_faro, faroData, userContext) => {
//     const faroExistente = await Faro.findByPk(id_faro);

//     if (!faroExistente) {
//       throw { statusCode: 404, msg: 'Faro no encontrado para actualizar' };
//     }

//     if (faroData.geocerca_geo) {
//       faroData.geocerca_geo = sequelize.literal(
//         `geometry::STGeomFromText('${faroData.geocerca_geo}', 4326)`
//       );
//     } else {
//       delete faroData.geocerca_geo;
//     }

//     await faroExistente.update(faroData);
//     return faroExistente;
//   },

//   // 🟢 Renombrado a deleteFaro
//   eliminarFaro: async (id_faro) => {
//     const faro = await Faro.findByPk(id_faro);

//     if (!faro) {
//       throw { statusCode: 404, msg: 'Faro no encontrado' };
//     }

//     await faro.update({ estado: false });
//     return { mensaje: 'Faro desactivado correctamente', id_faro: faro.id_faro };
//   }
// };

// module.exports = faroService;

/*
    Author: German Valencia
    Refactored for: QPLUS Standard (Clean Service Layer) - Maestro de Faros
    Description: Servicio para la gestión unificada de peajes, geocercas terrestres y zonas marítimas.
*/
const { Sequelize } = require('sequelize');
const { sequelize } = require('../../database/connection');
// NOTA: Asegúrate de tener el FaroDTO configurado igual que el TerminalDTO
const { FaroModel, FaroDTO } = require('../../models/torre-control/faro.model');
const { wrapToFeatureCollection } = require('../../utils/geoJsonHelper');
const { io } = require('../../index');

class FarosService {
  constructor() {
    this.model = FaroModel(sequelize);
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

    const coordsStr = match[1];
    const coordinates = coordsStr.split(',').map(pair => {
      return pair.trim().split(' ').map(Number);
    });

    return { type: 'Polygon', coordinates: [coordinates] };
  }

  _geoJsonToWkt(geoObj) {
    if (!geoObj || !geoObj.coordinates) return null;

    if (geoObj.type === 'Point') {
      return `POINT(${geoObj.coordinates[0]} ${geoObj.coordinates[1]})`;
    }

    if (geoObj.type === 'Polygon') {
      const rings = geoObj.coordinates.map(ring => {
        return '(' + ring.map(coord => `${coord[0]} ${coord[1]}`).join(', ') + ')';
      }).join(', ');
      return `POLYGON(${rings})`;
    }

    return null;
  }

  // 2. Mapeo para Angular (El viaje de Vuelta)
  _mapearRegistro(faroInstancia) {
    const f = faroInstancia.get({ plain: true });

    // Intentamos extraer como Polígono, y si falla (ej. peaje), probamos como Punto
    let rawGeometry = this._parseWktPolygon(f.geocerca_text);
    if (!rawGeometry) {
      rawGeometry = this._parseWktPoint(f.geocerca_text);
    }

    // Mantenemos tu lógica original de pasar metadata clave al GeoJSON
    const propiedadesMapbox = {
      id_faro: f.id_faro,
      nombre_faro: f.nombre_faro,
      color_ui: f.color_ui,
      tipo_faro: f.tipo_faro,
      descripcion: f.descripcion,
      genera_alerta_toast: f.genera_alerta_toast
    };

    return {
      ...f,
      geocerca_geo: rawGeometry ? wrapToFeatureCollection(rawGeometry, propiedadesMapbox) : null,

      // Limpiamos la cadena cruda SQL
      geocerca_text: undefined
    };
  }

  // 3. CRUD de Lectura
  async getFaros() {
    try {
      const faros = await this.model.findAll({
        where: { estado: true },
        attributes: {
          // Usamos el alias geocerca_text estándar de QPLUS
          include: [[Sequelize.literal('geocerca_geo.STAsText()'), 'geocerca_text']]
        }
      });

      return {
        statusCode: 200,
        ok: true,
        data: faros.map(f => this._mapearRegistro(f))
      };
    } catch (error) {
      console.error("🔴 Error en FarosService (getFaros):", error);
      throw error;
    }
  }

  async getFaroById(id_faro) {
    try {
      const faro = await this.model.findByPk(id_faro, {
        attributes: {
          include: [[Sequelize.literal('geocerca_geo.STAsText()'), 'geocerca_text']]
        }
      });

      if (!faro) {
        return { statusCode: 404, ok: false, data: null };
      }

      return {
        statusCode: 200,
        ok: true,
        data: this._mapearRegistro(faro)
      };
    } catch (error) {
      console.error("🔴 Error en FarosService (getFaroById):", error);
      throw error;
    }
  }

  // 4. CRUD de Escritura
  async crearFaro(rawData, userContext = { codigoUsuario: 'SISTEMA_ADMIN' }) {
    try {
      const dataDTO = FaroDTO(rawData, userContext);

      // Conversión de fechas si existe (estándar preventivo)
      if (dataDTO.fecha_cargue instanceof Date) {
        dataDTO.fecha_cargue = dataDTO.fecha_cargue.toISOString();
      }

      if (dataDTO.geocerca_geo) {
        const wkt = this._geoJsonToWkt(dataDTO.geocerca_geo);
        dataDTO.geocerca_geo = Sequelize.literal(`geometry::STGeomFromText('${wkt}', 4326)`);
      }

      return await sequelize.transaction(async (t) => {
        const nuevoFaro = await this.model.create(dataDTO, { transaction: t });
        if (typeof io !== 'undefined') io.emit('faros-actualizados', { action: 'create' });
        return nuevoFaro;
      });
    } catch (error) { throw error; }
  }

  async updateFaro(id_faro, rawData, userContext = { codigoUsuario: 'SISTEMA_ADMIN' }) {
    try {
      const dataDTO = FaroDTO(rawData, userContext);

      if (dataDTO.fecha_cargue instanceof Date) {
        dataDTO.fecha_cargue = dataDTO.fecha_cargue.toISOString();
      }

      if (dataDTO.geocerca_geo) {
        const wkt = this._geoJsonToWkt(dataDTO.geocerca_geo);
        dataDTO.geocerca_geo = Sequelize.literal(`geometry::STGeomFromText('${wkt}', 4326)`);
      } else if (dataDTO.geocerca_geo === null) {
        dataDTO.geocerca_geo = null;
      } else {
        delete dataDTO.geocerca_geo;
      }

      return await sequelize.transaction(async (t) => {
        const faroExistente = await this.model.findByPk(id_faro, { transaction: t });
        if (!faroExistente) throw { statusCode: 404, msg: 'Faro no encontrado para actualizar' };

        await faroExistente.update(dataDTO, { transaction: t });
        if (typeof io !== 'undefined') io.emit('faros-actualizados', { action: 'update' });

        return faroExistente;
      });
    } catch (error) { throw error; }
  }

  async deleteFaro(id_faro) {
    try {
      return await sequelize.transaction(async (t) => {
        const faro = await this.model.findByPk(id_faro, { transaction: t });

        if (!faro) throw { statusCode: 404, msg: 'Faro no encontrado' };

        // Mantenemos tu borrado lógico (Soft Delete)
        await faro.update({ estado: false }, { transaction: t });
        if (typeof io !== 'undefined') io.emit('faros-actualizados', { action: 'delete' });

        return { mensaje: 'Faro desactivado correctamente', id_faro: faro.id_faro };
      });
    } catch (error) { throw error; }
  }
}

module.exports = new FarosService(); // Opcional: exportar la instancia o la clase según uses en el Controller