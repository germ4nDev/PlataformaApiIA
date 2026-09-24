// /*
//     Author: German Valencia
//     Refactored for: PORTTOS Standard (Clean Service Layer) - Catálogo de Widgets
// */
// const { Sequelize } = require('sequelize');
// const { sequelize } = require('../../database/connection');
// const { TerminalModel, TerminalDTO } = require('../../models/torre-control/terminal.model.js');
// const { wrapToFeatureCollection } = require('../../utils/geoJsonHelper.js');
// const { io } = require('../../index');

// class TerminalsService {
//   constructor() {
//     this.model = TerminalModel(sequelize);
//   }

//   _parseWktPoint(wkt) {
//     if (!wkt) return null;
//     const match = wkt.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/);
//     if (!match) return null;

//     return {
//       type: 'Point',
//       coordinates: [parseFloat(match[1]), parseFloat(match[2])] // [lon, lat]
//     };
//   }

//   _parseWktPolygon(wkt) {
//     if (!wkt) return null;
//     const match = wkt.match(/POLYGON\s*\(\((.+)\)\)/);
//     if (!match) return null;

//     const coordsStr = match[1]; // "-74.95 10.95, -74.7 10.95..."
//     const coordinates = coordsStr.split(',').map(pair => {
//       return pair.trim().split(' ').map(Number);
//     });

//     return { type: 'Polygon', coordinates: [coordinates] };
//   }

//   // 2. Mapeo para Angular (El viaje de Vuelta)
//   _mapearRegistro(TerminalInstancia) {
//     const p = TerminalInstancia.get({ plain: true });

//     // Solo extraemos el polígono de la geocerca
//     const polygonGeometry = this._parseWktPolygon(p.geocerca_text);

//     return {
//       ...p,
//       geocerca_geo: wrapToFeatureCollection(polygonGeometry),

//       // Limpiamos el campo de texto extraído de SQL
//       geocerca_text: undefined
//     };
//   }

//   // Permite buscar todos o filtrar
//   async getTerminales() {
//     try {
//       const registros = await this.model.findAll({
//         attributes: {
//           include: [
//             [Sequelize.literal('geocerca_geo.STAsText()'), 'geocerca_text']
//           ]
//         }
//       });

//       return {
//         ok: true,
//         data: registros.map(p => this._mapearRegistro(p)),
//         statusCode: 200
//       };
//     } catch (error) {
//       console.error("🔴 Error en TerminalsService (getTerminales):", error);
//       throw error;
//     }
//   }

//   async getTerminalesByIdTerminal(id_Terminal) {
//     try {
//       const terminal = await this.model.findOne({
//         where: { id_Terminal: id_Terminal }, // 🐛 Variable corregida
//         attributes: {
//           include: [
//             [Sequelize.literal('geocerca_geo.STAsText()'), 'geocerca_text']
//           ]
//         }
//       });

//       if (!terminal) return { ok: false, statusCode: 404 };

//       return {
//         ok: true,
//         data: this._mapearRegistro(terminal),
//         statusCode: 200
//       };
//     } catch (error) {
//       console.error("🔴 Error en TerminalsService (getTerminalesByIdTerminal):", error);
//       throw error;
//     }
//   }

//   async getTerminalById(id_terminal) {
//     try {
//       const terminal = await this.model.findOne({
//         where: { id_terminal: id_terminal },
//         attributes: {
//           include: [
//             [Sequelize.literal('geocerca_geo.STAsText()'), 'geocerca_text']
//           ]
//         }
//       });

//       if (!terminal) return { ok: false, statusCode: 404 };

//       return {
//         ok: true,
//         data: this._mapearRegistro(terminal),
//         statusCode: 200
//       };
//     } catch (error) {
//       console.error("🔴 Error en TerminalsService (getTerminalById):", error);
//       throw error;
//     }
//   }

//   async crearTerminal(rawData, userContext = { codigoUsuario: 'SISTEMA_ADMIN' }) {
//     try {
//       const dataDTO = TerminalDTO(rawData, userContext);

//       // 🔥 FIX SQL SERVER: Tomamos el string WKT que hizo el DTO y lo envolvemos en el literal MSSQL
//       if (dataDTO.geocerca_geo) {
//         dataDTO.geocerca_geo = Sequelize.literal(`geometry::STGeomFromText('${dataDTO.geocerca_geo}', 4326)`);
//       }

//       return await sequelize.transaction(async (t) => {
//         const nuevo = await this.model.create(dataDTO, { transaction: t });
//         if (typeof io !== 'undefined') io.emit('terminales-actualizados', { action: 'create' });
//         return nuevo;
//       });
//     } catch (error) { throw error; }
//   }

//   async updateTerminal(id_Terminal, rawData, userContext = { codigoUsuario: 'SISTEMA_ADMIN' }) {
//     try {
//       const dataDTO = TerminalDTO(rawData, userContext);

//       // 🔥 FIX SQL SERVER: Mismo proceso para la actualización
//       if (dataDTO.geocerca_geo) {
//         dataDTO.geocerca_geo = Sequelize.literal(`geometry::STGeomFromText('${dataDTO.geocerca_geo}', 4326)`);
//       }

//       return await sequelize.transaction(async (t) => {
//         await this.model.update(dataDTO, { where: { id_Terminal }, transaction: t });
//         const actualizado = await this.model.findOne({ where: { id_Terminal }, transaction: t });
//         if (typeof io !== 'undefined') io.emit('terminales-actualizados', { action: 'update' });
//         return actualizado;
//       });
//     } catch (error) { throw error; }
//   }

//   async deleteTerminal(id_Terminal) {
//     try {
//       return await sequelize.transaction(async (t) => {
//         await this.model.destroy({ where: { id_Terminal }, transaction: t });
//         if (typeof io !== 'undefined') io.emit('Terminals-actualizados', { action: 'delete' });
//         return { success: true };
//       });
//     } catch (error) { throw error; }
//   }
// }

// module.exports = TerminalsService;
/*
    Author: German Valencia
    Refactored for: PORTTOS Standard (Clean Service Layer) - Catálogo de Widgets (Terminales)
*/
const { Sequelize } = require('sequelize');
const { sequelize } = require('../../database/connection');
const { TerminalModel, TerminalDTO } = require('../../models/torre-control/terminal.model.js');
const { wrapToFeatureCollection } = require('../../utils/geoJsonHelper.js');
const { io } = require('../../index');

class TerminalsService {
  constructor() {
    this.model = TerminalModel(sequelize);
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

  _geoJsonToWkt(geoObj) {
    if (!geoObj || !geoObj.coordinates) return null;

    if (geoObj.type === 'Point') {
      return `POINT(${geoObj.coordinates[0]} ${geoObj.coordinates[1]})`;
    }

    if (geoObj.type === 'Polygon') {
      // Soportar múltiples anillos (exterior e interiores/huecos)
      const rings = geoObj.coordinates.map(ring => {
        return '(' + ring.map(coord => `${coord[0]} ${coord[1]}`).join(', ') + ')';
      }).join(', ');
      return `POLYGON(${rings})`;
    }

    return null;
  }

  // 2. Mapeo para Angular (El viaje de Vuelta)
  _mapearRegistro(TerminalInstancia) {
    const p = TerminalInstancia.get({ plain: true });

    // Solo extraemos el polígono de la geocerca
    const polygonGeometry = this._parseWktPolygon(p.geocerca_text);

    return {
      ...p,
      geocerca_geo: wrapToFeatureCollection(polygonGeometry),

      // Limpiamos el campo de texto extraído de SQL
      geocerca_text: undefined
    };
  }

  // 3. CRUD de Lectura
  async getTerminales() {
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
      console.error("🔴 Error en TerminalsService (getTerminales):", error);
      throw error;
    }
  }

  async getTerminalById(id_terminal) {
    try {
      const terminal = await this.model.findOne({
        where: { id_terminal: id_terminal },
        attributes: {
          include: [
            [Sequelize.literal('geocerca_geo.STAsText()'), 'geocerca_text']
          ]
        }
      });

      if (!terminal) return { ok: false, statusCode: 404 };

      return {
        ok: true,
        data: this._mapearRegistro(terminal),
        statusCode: 200
      };
    } catch (error) {
      console.error("🔴 Error en TerminalsService (getTerminalById):", error);
      throw error;
    }
  }

  // 4. CRUD de Escritura (Usa el patrón DTO PORTTOS)
  async crearTerminal(rawData, userContext = { codigoUsuario: 'SISTEMA_ADMIN' }) {
    try {
      const dataDTO = TerminalDTO(rawData, userContext);

      // A. Transformar fecha Date a String para coincidir con la BD
      if (dataDTO.fecha_cargue instanceof Date) {
        dataDTO.fecha_cargue = dataDTO.fecha_cargue.toISOString();
      }

      // B. Transformar los objetos GeoJSON a literales de SQL Server
      if (dataDTO.geocerca_geo) {
        const wkt = this._geoJsonToWkt(dataDTO.geocerca_geo);
        dataDTO.geocerca_geo = Sequelize.literal(`geometry::STGeomFromText('${wkt}', 4326)`);
      }

      return await sequelize.transaction(async (t) => {
        const nuevo = await this.model.create(dataDTO, { transaction: t });
        if (typeof io !== 'undefined') io.emit('terminales-actualizados', { action: 'create' });
        return nuevo;
      });
    } catch (error) {
      throw error;
    }
  }

  async updateTerminal(id_terminal, rawData, userContext = { codigoUsuario: 'SISTEMA_ADMIN' }) {
    try {
      const dataDTO = TerminalDTO(rawData, userContext);

      // A. Transformar fecha Date a String para coincidir con la BD
      if (dataDTO.fecha_cargue instanceof Date) {
        dataDTO.fecha_cargue = dataDTO.fecha_cargue.toISOString();
      }

      // B. Transformamos a literales o gestionamos correctamente la ausencia del campo
      if (dataDTO.geocerca_geo) {
        const wkt = this._geoJsonToWkt(dataDTO.geocerca_geo);
        dataDTO.geocerca_geo = Sequelize.literal(`geometry::STGeomFromText('${wkt}', 4326)`);
      } else if (dataDTO.geocerca_geo === null) {
        // Si el cliente envía explícitamente null, permitimos que se borre de la BD
        dataDTO.geocerca_geo = null;
      } else {
        // Si es undefined, lo borramos del objeto para que no se altere en la BD
        delete dataDTO.geocerca_geo;
      }

      return await sequelize.transaction(async (t) => {
        await this.model.update(dataDTO, { where: { id_terminal }, transaction: t });
        const actualizado = await this.model.findOne({ where: { id_terminal }, transaction: t });
        if (typeof io !== 'undefined') io.emit('terminales-actualizados', { action: 'update' });
        return actualizado;
      });
    } catch (error) {
      throw error;
    }
  }

  async deleteTerminal(id_terminal) {
    try {
      return await sequelize.transaction(async (t) => {
        await this.model.destroy({ where: { id_terminal }, transaction: t });
        if (typeof io !== 'undefined') io.emit('terminales-actualizados', { action: 'delete' });
        return { success: true };
      });
    } catch (error) {
      throw error;
    }
  }
}

module.exports = TerminalsService;