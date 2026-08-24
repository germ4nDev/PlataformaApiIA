/*
    Author: German Valencia
    Pattern: QPLUS DTO Pattern - Maestro de Puertos
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const GeoJSONSchema = Joi.object({
  type: Joi.string().valid('FeatureCollection').required(),
  features: Joi.array().items(
    Joi.object({
      type: Joi.string().valid('Feature').required(),
      geometry: Joi.object({
        type: Joi.string().valid('Point', 'Polygon', 'LineString', 'MultiPolygon').required(),
        coordinates: Joi.array().required()
      }).required(),
      properties: Joi.object().optional().allow(null)
    })
  ).required()
});

// 1. EL ESCUDO: Validación
// const PuertoSchema = Joi.object({
//   id_puerto: Joi.string().max(50).required(),
//   nombre: Joi.string().max(100).required(),
//   region: Joi.string().max(100).required(),
//   // Solución: Agregamos max(4000)
//   descripcion: Joi.string().max(4000).allow(null, '').optional(),
//   // Solución: Agregamos max(100)
//   imagen_url: Joi.string().uri().max(500).allow(null, '').optional(),
//   ubicacion_geo: GeoJSONSchema.allow(null),
//   geocerca_geo: GeoJSONSchema.allow(null),
//   color_ui: Joi.string().max(20).allow('', null),
//   url_fuente_scraping: Joi.string().max(500).allow(null, ''),
//   estado: Joi.boolean().default(true)
// });

// // 2. EL ENSAMBLADOR: DTO
// const PuertoDTO = (rawData, userContext = { codigoUsuario: 'SISTEMA_ADMIN' }) => {
//   const { error, value } = PuertoSchema.validate(rawData, {
//     abortEarly: false,
//     stripUnknown: true
//   });

//   if (error) {
//     throw {
//       type: 'ValidationError',
//       details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
//     };
//   }

//   const extractGeometry = (geoData) => {
//     if (!geoData) return null;

//     if (geoData.geocerca && geoData.geocerca.type) {
//       return geoData.geocerca;
//     }
//     if (geoData.ubicacion && geoData.ubicacion.type) {
//       return geoData.ubicacion;
//     }

//     if (geoData.type === 'FeatureCollection' && geoData.features && geoData.features.length > 0) {
//       return geoData.features[0].geometry;
//     }

//     if (geoData.type === 'Point' || geoData.type === 'Polygon') {
//       return geoData;
//     }

//     return null;
//   };

//   return {
//     id_puerto: rawData.id_puerto,
//     nombre: rawData.nombre,
//     region: rawData.region,
//     descripcion: rawData.descripcion,
//     url_fuente_scraping: rawData.url_fuente_scraping,
//     color_ui: rawData.color_ui,
//     imagen_url: rawData.imagen_url,
//     estado: rawData.estado === true || rawData.estado === 'true' || rawData.estado === 1,
//     ubicacion_geo: extractGeometry(rawData.ubicacion_geo),
//     geocerca_geo: extractGeometry(rawData.geocerca_geo),
//     usuario_cargue: userContext.codigoUsuario || rawData.usuario_cargue || 'SISTEMA_ADMIN',
//     fecha_cargue: rawData.fecha_cargue ? new Date(rawData.fecha_cargue) : new Date()
//   };
// };
const PuertoSchema = Joi.object({
  id_puerto: Joi.string().max(50).required(),
  nombre: Joi.string().max(100).required(),
  region: Joi.string().max(100).required(),
  descripcion: Joi.string().max(4000).allow(null, '').optional(),

  // SOLUCIÓN 1: Quitamos .uri() porque recibes un nombre de archivo (UUID.jpeg), no una ruta web completa
  imagen_url: Joi.string().max(500).allow(null, '').optional(),

  // SOLUCIÓN 2: Permitimos cualquier objeto en las geometrías para que el DTO las procese sin que Joi aborte
  ubicacion_geo: Joi.object().unknown(true).allow(null),
  geocerca_geo: Joi.object().unknown(true).allow(null),

  color_ui: Joi.string().max(20).allow('', null),
  url_fuente_scraping: Joi.string().max(500).allow(null, ''),
  estado: Joi.boolean().default(true)
});

// 2. EL ENSAMBLADOR: DTO
const PuertoDTO = (rawData, userContext = { codigoUsuario: 'SISTEMA_ADMIN' }) => {
  // Validamos usando el escudo relajado
  const { error, value } = PuertoSchema.validate(rawData, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  // La función a prueba de balas para sacar la geometría del objeto de Angular
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

  // Retornamos mapeando desde 'value' (los datos ya validados por Joi) y no desde 'rawData'
  return {
    id_puerto: value.id_puerto,
    nombre: value.nombre,
    region: value.region,
    descripcion: value.descripcion,
    url_fuente_scraping: value.url_fuente_scraping,
    color_ui: value.color_ui,
    imagen_url: value.imagen_url,
    estado: value.estado,
    ubicacion_geo: extractGeometry(rawData.ubicacion_geo),
    geocerca_geo: extractGeometry(rawData.geocerca_geo),
    usuario_cargue: userContext.codigoUsuario || rawData.usuario_cargue || 'SISTEMA_ADMIN',
    fecha_cargue: rawData.fecha_cargue ? new Date(rawData.fecha_cargue) : new Date()
  };
};

const PuertoModel = (sequelize) => {
  return sequelize.define('T_Maestro_Puertos', {
    id_puerto: { type: DataTypes.STRING(50), primaryKey: true },
    nombre: { type: DataTypes.STRING(100), allowNull: false },
    region: { type: DataTypes.STRING(100), allowNull: false },
    descripcion: { type: DataTypes.STRING(4000), allowNull: true },
    ubicacion_geo: { type: DataTypes.GEOMETRY('POINT'), allowNull: true },
    geocerca_geo: { type: DataTypes.GEOMETRY('POLYGON'), allowNull: true },
    color_ui: { type: DataTypes.STRING(20), allowNull: true },
    estado: { type: DataTypes.BOOLEAN, allowNull: true },
    imagen_url: { type: DataTypes.STRING(500), allowNull: true },
    url_fuente_scraping: { type: DataTypes.STRING(500), allowNull: true },
    usuario_cargue: { type: DataTypes.STRING(200), allowNull: true },
    fecha_cargue: { type: DataTypes.STRING(100), allowNull: true }
  }, {
    tableName: 'T_Maestro_Puertos',
    timestamps: false
  });
};

module.exports = { PuertoModel, PuertoDTO, PuertoSchema };