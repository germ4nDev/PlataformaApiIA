/*
    Author: German Valencia
    Pattern: PORTTOS DTO Pattern - Maestro de Infraestructura
    Update: Homologado con GeoJSON FeatureCollection y Arquitectura Espacial
*/
const Joi = require('joi');
const { DataTypes, Sequelize } = require('sequelize');

// 0. ESQUEMA REUTILIZABLE PARA GEOJSON (Homologado)
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

// 1. EL ESCUDO: Validación de infraestructura
const InfraestructuraSchema = Joi.object({
  id_terminal: Joi.string().max(50).required(),
  id_tipo: Joi.number().required(),
  tipo: Joi.string().max(50).required(),
  nombre: Joi.string().max(250).required(),
  ubicacion_geo: Joi.object().unknown(true).allow(null),
  geocerca_geo: Joi.object().unknown(true).allow(null),

  color_ui: Joi.string().max(20).allow('', null),
  estado: Joi.boolean().default(true)
});

// 2. EL ENSAMBLADOR: DTO con auditoría PORTTOS
const InfraestructuraDTO = (rawData, userContext = { codigoUsuario: 'SISTEMA_ADMIN' }) => {
  const { error, value } = InfraestructuraSchema.validate(rawData, { abortEarly: false, stripUnknown: true });
  if (error) throw { type: 'ValidationError', details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message })) };

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
    id_tipo: value.id_tipo,
    tipo: value.tipo.toLowerCase().trim(),
    nombre: value.nombre.trim(),
    ubicacion_geo: extractGeometry(value.ubicacion_geo),
    geocerca_geo: extractGeometry(value.geocerca_geo),
    color_ui: value.color_ui ? value.color_ui.trim() : null,
    estado: value.estado,

    usuario_cargue: userContext.codigoUsuario,
    fecha_cargue: rawData.fecha_cargue ? new Date(rawData.fecha_cargue) : new Date()
  };
};

// 3. EL MAPEO: Definición en Sequelize
const InfraestructuraModel = (sequelize) => {
  const Infra = sequelize.define('T_Maestro_Infraestructura', {
    id_infraestructura: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    id_terminal: { type: DataTypes.STRING(50), allowNull: false },
    id_tipo: { type: DataTypes.INTEGER, allowNull: false },
    tipo: { type: DataTypes.STRING(50), allowNull: true },
    nombre: { type: DataTypes.STRING(250), allowNull: true },
    ubicacion_geo: { type: DataTypes.GEOMETRY('POINT'), allowNull: true },
    geocerca_geo: { type: DataTypes.GEOMETRY('POLYGON'), allowNull: true },
    color_ui: { type: DataTypes.STRING(20), allowNull: true },
    descripcion: { type: DataTypes.STRING(4000), allowNull: true }, // <-- ¡AGREGA ESTO!
    estado: { type: DataTypes.BOOLEAN, allowNull: true },
    fecha_cargue: { type: DataTypes.STRING(100), allowNull: true }
  }, {
    tableName: 'T_Maestro_Infraestructura',
    schema: 'dbo',
    timestamps: false
  });

  /**
   * Sobrescritura de toJSON: 
   * Limpia el buffer binario y formatea la salida para Angular.
   */
  Infra.prototype.toJSON = function () {
    const values = Object.assign({}, this.get());

    if (values.geocerca_geo) {
      delete values.geocerca_geo;
    }

    return values;
  };

  return Infra;
};

module.exports = { InfraestructuraModel, InfraestructuraDTO, InfraestructuraSchema };