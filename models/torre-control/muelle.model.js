/*
    Author: German Valencia
    Pattern: PORTTOS DTO Pattern - Maestro de Muelles
    Update: Homologado con GeoJSON FeatureCollection (Puertos/Terminales)
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

// 0. ESQUEMA REUTILIZABLE PARA GEOJSON
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
const MuelleSchema = Joi.object({
  id_terminal: Joi.string().max(50).required(),   // Llave foránea
  codigo_muelle: Joi.string().max(50).required(),
  db_id_origen: Joi.string().max(50).required(),
  especialidad: Joi.string().max(100).allow('', null),
  calado_metros: Joi.number().min(0).max(40).allow(null),
  color_ui: Joi.string().max(20).allow('', null),
  descripcion: Joi.string().max(500).allow('', null),
  estado_mantenimiento: Joi.boolean().default(false),
  geocerca_geo: GeoJSONSchema.allow(null)
});

// 2. EL ENSAMBLADOR: DTO
const MuelleDTO = (rawData, userContext = { codigoUsuario: 'SISTEMA_ADMIN' }) => {
  const { error, value } = MuelleSchema.validate(rawData, { abortEarly: false, stripUnknown: true });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  // 🟢 LA VERDADERA MAGIA PORTTOS AHORA: Extraer la geometría del FeatureCollection
  const extractGeometryAsWKT = (geoJson) => {
    if (!geoJson || !geoJson.features || geoJson.features.length === 0) return null;

    const geometry = geoJson.features[0].geometry;

    // Si es un polígono, lo convertimos a la sintaxis WKT: POLYGON((lon lat, lon lat...))
    if (geometry.type === 'Polygon') {
      const rings = geometry.coordinates.map(ring => {
        const coordPairs = ring.map(coord => `${coord[0]} ${coord[1]}`).join(', ');
        return `(${coordPairs})`;
      });
      return `POLYGON(${rings.join(', ')})`;
    }

    // Si a futuro agregas puntos
    if (geometry.type === 'Point') {
      return `POINT(${geometry.coordinates[0]} ${geometry.coordinates[1]})`;
    }

    return null;
  };

  return {
    id_terminal: value.id_terminal.trim().toUpperCase(),
    codigo_muelle: value.codigo_muelle.trim().toUpperCase(),
    db_id_origen: value.db_id_origen.trim().toUpperCase(),
    especialidad: value.especialidad || null,
    calado_metros: value.calado_metros,
    color_ui: value.color_ui ? value.color_ui.trim() : null,
    descripcion: value.descripcion ? value.descripcion : null,
    estado_mantenimiento: value.estado_mantenimiento,
    geocerca_geo: extractGeometryAsWKT(value.geocerca_geo),

    usuario_cargue: userContext.codigoUsuario,
    fecha_cargue: new Date().toISOString()
  };
};

// 3. EL MAPEO: Sequelize
const MuelleModel = (sequelize) => {
  return sequelize.define('T_Maestro_Muelles', {
    id_interno: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, field: 'id_interno' },
    id_terminal: { type: DataTypes.STRING(50), allowNull: false },
    codigo_muelle: { type: DataTypes.STRING(50), allowNull: false },
    db_id_origen: { type: DataTypes.STRING(50), allowNull: false },
    especialidad: { type: DataTypes.STRING(100), allowNull: true },
    calado_metros: { type: DataTypes.DECIMAL(4, 1), allowNull: true },
    color_ui: { type: DataTypes.STRING(20), allowNull: true },
    descripcion: { type: DataTypes.STRING(500), allowNull: true },
    estado_mantenimiento: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    geocerca_geo: { type: DataTypes.GEOMETRY('POLYGON', 4326), allowNull: true },

    usuario_cargue: { type: DataTypes.STRING(200), allowNull: false },
    fecha_cargue: { type: DataTypes.STRING(100), allowNull: false } // 🟢 Homologado a DATE
  }, {
    tableName: 'T_Maestro_Muelles',
    schema: 'dbo',
    timestamps: false
  });
};

module.exports = { MuelleModel, MuelleDTO, MuelleSchema };