/*
    Author: German Valencia
    Pattern: PORTTOS DTO Pattern - Maestro de Faros
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

// 1. EL ESCUDO: Validación (Relajado para evitar bloqueos de Angular)
const FaroSchema = Joi.object({
  id_faro: Joi.number().integer().optional(), // Opcional para creación, DB hace auto-increment
  nombre_faro: Joi.string().max(100).required(),
  descripcion: Joi.string().max(500).allow('', null),

  tipo_faro: Joi.string().valid(
    'PEAJE',
    'ZONA_TERRESTRE',
    'ZONA_MARITIMA',
    'PUNTO_CONTROL'
  ).required(),

  radio_metros: Joi.number().allow(null),
  color_ui: Joi.string().max(20).allow('', null),
  metadata_extra: Joi.object().allow(null), // Validamos que entre como objeto JSON

  // SOLUCIÓN: Permitimos cualquier objeto en la geometría para que el DTO lo procese
  geocerca_geo: Joi.object().unknown(true).allow(null),

  genera_alerta_toast: Joi.boolean().default(false),
  estado: Joi.boolean().default(true)
});

// 2. EL ENSAMBLADOR: DTO
const FaroDTO = (rawData, userContext = { codigoUsuario: 'SISTEMA_ADMIN' }) => {
  const { error, value } = FaroSchema.validate(rawData, { abortEarly: false, stripUnknown: true });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  // La función a prueba de balas para sacar la geometría del objeto (Igual que Puertos/Terminales)
  const extractGeometry = (geoData) => {
    if (!geoData) return null;

    // Si viene del form reactivo de Angular
    if (geoData.geocerca && geoData.geocerca.type) return geoData.geocerca;
    if (geoData.ubicacion && geoData.ubicacion.type) return geoData.ubicacion;

    // Si viene como FeatureCollection
    if (geoData.type === 'FeatureCollection' && geoData.features && geoData.features.length > 0) {
      return geoData.features[0].geometry;
    }

    // Si es geometría pura (Soportamos Point para peajes y Polygon para zonas)
    if (geoData.type === 'Point' || geoData.type === 'Polygon' || geoData.type === 'LineString' || geoData.type === 'MultiPolygon') {
      return geoData;
    }

    return null;
  };

  return {
    ...(value.id_faro && { id_faro: value.id_faro }),
    nombre_faro: value.nombre_faro.trim().toUpperCase(),
    descripcion: value.descripcion ? value.descripcion.trim() : null,
    tipo_faro: value.tipo_faro.trim().toUpperCase(),
    radio_metros: value.radio_metros,
    color_ui: value.color_ui ? value.color_ui.trim() : null,
    metadata_extra: value.metadata_extra ? JSON.stringify(value.metadata_extra) : null,

    // 🔥 Extraemos la geometría limpia y corregimos el nombre de la variable
    geocerca_geo: extractGeometry(rawData.geocerca_geo),

    genera_alerta_toast: value.genera_alerta_toast,
    estado: value.estado,

    usuario_cargue: userContext.codigoUsuario || rawData.usuario_cargue || 'SISTEMA_ADMIN',
    // Mantenemos formato de fecha compatible con el modelo y el servicio
    fecha_cargue: rawData.fecha_cargue ? new Date(rawData.fecha_cargue) : new Date()
  };
};

// 3. EL MAPEO: Sequelize
const FaroModel = (sequelize) => {
  return sequelize.define('T_Maestro_Faros', {
    id_faro: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
      field: 'id_faro'
    },
    nombre_faro: { type: DataTypes.STRING(100), allowNull: false },
    descripcion: { type: DataTypes.STRING(500), allowNull: true },
    tipo_faro: { type: DataTypes.STRING(50), allowNull: false },
    radio_metros: { type: DataTypes.FLOAT, allowNull: true },
    color_ui: { type: DataTypes.STRING(20), allowNull: true },
    metadata_extra: { type: DataTypes.STRING('MAX'), allowNull: true },
    geocerca_geo: { type: DataTypes.GEOMETRY, allowNull: true },
    genera_alerta_toast: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    estado: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: true },
    usuario_cargue: { type: DataTypes.STRING(200), allowNull: false },
    fecha_cargue: { type: DataTypes.STRING(100), allowNull: false }
  }, {
    tableName: 'TCL_MaestroFaros',
    schema: 'dbo',
    timestamps: false
  });
};

module.exports = { FaroModel, FaroDTO, FaroSchema };