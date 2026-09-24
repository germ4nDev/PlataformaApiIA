// /*
//     Author: German Valencia
//     Pattern: PORTTOS DTO Pattern - Maestro de Terminales
// */
// const Joi = require('joi');
// const { DataTypes } = require('sequelize');

// const GeoJSONSchema = Joi.object({
//   type: Joi.string().valid('FeatureCollection').required(),
//   features: Joi.array().items(
//     Joi.object({
//       type: Joi.string().valid('Feature').required(),
//       geometry: Joi.object({
//         type: Joi.string().valid('Point', 'Polygon', 'LineString', 'MultiPolygon').required(),
//         coordinates: Joi.array().required()
//       }).required(),
//       properties: Joi.object().optional().allow(null)
//     })
//   ).required()
// });

// // 1. EL ESCUDO: Validación
// const TerminalSchema = Joi.object({
//   id_terminal: Joi.string().max(50).required(),
//   id_puerto: Joi.string().max(50).required(),
//   nombre: Joi.string().max(150).required(),
//   subtitulo: Joi.string().max(200).allow('', null),
//   descripcion: Joi.string().max(500).allow('', null),
//   unidad_medida: Joi.string().max(50).default('TM HOY'),
//   capacidad_reefer: Joi.number().integer().min(0).default(0),
//   geocerca_geo: GeoJSONSchema.allow(null),
//   color_ui: Joi.string().max(20).allow('', null),
//   estado: Joi.boolean().default(true)
// });

// // 2. EL ENSAMBLADOR: DTO
// const TerminalDTO = (rawData, userContext = { codigoUsuario: 'SISTEMA_ADMIN' }) => {
//   const { error, value } = TerminalSchema.validate(rawData, { abortEarly: false, stripUnknown: true });

//   if (error) {
//     throw {
//       type: 'ValidationError',
//       details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
//     };
//   }

//   // 🟢 CORRECCIÓN: Extraemos la geometría y la transformamos a WKT (String)
//   const extractGeometryAsWKT = (geoJson) => {
//     if (!geoJson || !geoJson.features || geoJson.features.length === 0) return null;

//     const geometry = geoJson.features[0].geometry;

//     // Si es un polígono, lo convertimos a la sintaxis WKT: POLYGON((lon lat, lon lat...))
//     if (geometry.type === 'Polygon') {
//       const rings = geometry.coordinates.map(ring => {
//         const coordPairs = ring.map(coord => `${coord[0]} ${coord[1]}`).join(', ');
//         return `(${coordPairs})`;
//       });
//       return `POLYGON(${rings.join(', ')})`;
//     }

//     // Si a futuro agregas puntos
//     if (geometry.type === 'Point') {
//       return `POINT(${geometry.coordinates[0]} ${geometry.coordinates[1]})`;
//     }

//     return null;
//   };

//   return {
//     id_terminal: value.id_terminal.trim().toUpperCase(),
//     id_puerto: value.id_puerto.trim().toUpperCase(),
//     nombre: value.nombre.trim(),
//     subtitulo: value.subtitulo ? value.subtitulo.trim() : null,
//     descripcion: value.descripcion ? value.descripcion.trim() : null,
//     unidad_medida: value.unidad_medida.trim().toUpperCase(),
//     capacidad_reefer: value.capacidad_reefer,
//     color_ui: value.color_ui ? value.color_ui.trim() : null,
//     // 🔥 Ahora esto devuelve un string listo para el Sequelize.literal del servicio
//     geocerca_geo: extractGeometryAsWKT(value.geocerca_geo),
//     estado: value.estado,

//     usuario_cargue: userContext.codigoUsuario,
//     fecha_cargue: new Date().toISOString()
//   };
// };

// // 3. EL MAPEO: Sequelize
// const TerminalModel = (sequelize) => {
//   return sequelize.define('T_Maestro_Terminales', {
//     id_terminal: { type: DataTypes.STRING(50), primaryKey: true, allowNull: false, field: 'id_terminal' },
//     id_puerto: { type: DataTypes.STRING(50), allowNull: false },
//     nombre: { type: DataTypes.STRING(150), allowNull: false },
//     subtitulo: { type: DataTypes.STRING(200), allowNull: true },
//     descripcion: { type: DataTypes.STRING(500), allowNull: true },
//     unidad_medida: { type: DataTypes.STRING(50), allowNull: true, defaultValue: 'TM HOY' },
//     capacidad_reefer: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
//     geocerca_geo: { type: DataTypes.GEOMETRY('POLYGON'), allowNull: true },
//     color_ui: { type: DataTypes.STRING(20), allowNull: true },
//     estado: { type: DataTypes.BOOLEAN, allowNull: true },

//     usuario_cargue: { type: DataTypes.STRING(200), allowNull: false },
//     fecha_cargue: { type: DataTypes.STRING(100), allowNull: false } // Homologado a DATE igual que en puertos
//   }, {
//     tableName: 'T_Maestro_Terminales',
//     schema: 'dbo',
//     timestamps: false
//   });
// };

// module.exports = { TerminalModel, TerminalDTO, TerminalSchema };
/*
    Author: German Valencia
    Pattern: PORTTOS DTO Pattern - Maestro de Terminales
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

// 1. EL ESCUDO: Validación (Relajado para evitar bloqueos de Angular)
const TerminalSchema = Joi.object({
  id_terminal: Joi.string().max(50).required(),
  id_puerto: Joi.string().max(50).required(),
  nombre: Joi.string().max(150).required(),
  subtitulo: Joi.string().max(200).allow('', null),
  descripcion: Joi.string().max(500).allow('', null),
  unidad_medida: Joi.string().max(50).default('TM HOY'),
  capacidad_reefer: Joi.number().integer().min(0).default(0),

  // SOLUCIÓN: Permitimos cualquier objeto en la geometría para que el DTO lo procese
  geocerca_geo: Joi.object().unknown(true).allow(null),

  color_ui: Joi.string().max(20).allow('', null),
  estado: Joi.boolean().default(true)
});

// 2. EL ENSAMBLADOR: DTO
const TerminalDTO = (rawData, userContext = { codigoUsuario: 'SISTEMA_ADMIN' }) => {
  const { error, value } = TerminalSchema.validate(rawData, { abortEarly: false, stripUnknown: true });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  // La función a prueba de balas para sacar la geometría del objeto (Igual que en Puertos)
  const extractGeometry = (geoData) => {
    if (!geoData) return null;

    // Si viene del form reactivo de Angular
    if (geoData.geocerca && geoData.geocerca.type) return geoData.geocerca;
    if (geoData.ubicacion && geoData.ubicacion.type) return geoData.ubicacion;

    // Si viene como FeatureCollection
    if (geoData.type === 'FeatureCollection' && geoData.features && geoData.features.length > 0) {
      return geoData.features[0].geometry;
    }

    // Si es geometría pura
    if (geoData.type === 'Point' || geoData.type === 'Polygon') return geoData;

    return null;
  };

  return {
    id_terminal: value.id_terminal.trim().toUpperCase(),
    id_puerto: value.id_puerto.trim().toUpperCase(),
    nombre: value.nombre.trim(),
    subtitulo: value.subtitulo ? value.subtitulo.trim() : null,
    descripcion: value.descripcion ? value.descripcion.trim() : null,
    unidad_medida: value.unidad_medida.trim().toUpperCase(),
    capacidad_reefer: value.capacidad_reefer,
    color_ui: value.color_ui ? value.color_ui.trim() : null,

    // Extraemos la geometría limpia. El Servicio se encargará del Sequelize.literal
    geocerca_geo: extractGeometry(rawData.geocerca_geo),

    estado: value.estado,
    usuario_cargue: userContext.codigoUsuario || rawData.usuario_cargue || 'SISTEMA_ADMIN',
    // Mantenemos formato de fecha compatible con el modelo
    fecha_cargue: rawData.fecha_cargue ? new Date(rawData.fecha_cargue) : new Date()
  };
};

// 3. EL MAPEO: Sequelize
const TerminalModel = (sequelize) => {
  return sequelize.define('T_Maestro_Terminales', {
    id_terminal: { type: DataTypes.STRING(50), primaryKey: true, allowNull: false, field: 'id_terminal' },
    id_puerto: { type: DataTypes.STRING(50), allowNull: false },
    nombre: { type: DataTypes.STRING(150), allowNull: false },
    subtitulo: { type: DataTypes.STRING(200), allowNull: true },
    descripcion: { type: DataTypes.STRING(500), allowNull: true },
    unidad_medida: { type: DataTypes.STRING(50), allowNull: true, defaultValue: 'TM HOY' },
    capacidad_reefer: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
    geocerca_geo: { type: DataTypes.GEOMETRY('POLYGON'), allowNull: true },
    color_ui: { type: DataTypes.STRING(20), allowNull: true },
    estado: { type: DataTypes.BOOLEAN, allowNull: true },

    usuario_cargue: { type: DataTypes.STRING(200), allowNull: false },
    fecha_cargue: { type: DataTypes.STRING(100), allowNull: false }
  }, {
    tableName: 'T_Maestro_Terminales',
    schema: 'dbo',
    timestamps: false
  });
};

module.exports = { TerminalModel, TerminalDTO, TerminalSchema };