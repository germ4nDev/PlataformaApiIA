/*
    Author: German Valencia
    Pattern: PORTTOS DTO Pattern - Flota Terrestre (Solo Espacial)
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

// 1. Esquema de Validación: Eliminados lat/lon, integrado ubicacion_geo
const FlotaTerrestreSchema = Joi.object({
  _id: Joi.string().max(50).required(),
  placa: Joi.string().max(10).required(),
  modelo: Joi.number().integer().min(1900).max(2100).optional(),
  tipo_camion: Joi.string().max(50).optional(),
  estado_camion: Joi.string().valid('EN_RUTA', 'DETENIDO', 'MANTENIMIENTO', 'DESCARGANDO', 'DETENIDO_POR_TRAFICO').default('EN_RUTA'),
  conductor: Joi.string().max(100).allow('', null).optional(),
  velocidad: Joi.number().min(0).default(0),

  // Esquema espacial estricto (GeoJSON)
  ubicacion_geo: Joi.object({
    type: Joi.string().valid('Point').required(),
    coordinates: Joi.array().items(Joi.number()).length(2).required() // [longitud, latitud]
  }).required()
});

// 2. DTO: Simplificado para manejar solo el objeto espacial
const FlotaTerrestreDTO = (rawData, userContext = { codigoUsuario: 'CRON_TERRESTRE_SYS' }) => {
  const { error, value } = FlotaTerrestreSchema.validate(rawData, { abortEarly: false, stripUnknown: true });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const fechaISO = new Date().toISOString();
  const usuarioIngesta = userContext.codigoUsuario;

  return {
    _id: value._id,
    placa: value.placa.trim().toUpperCase(),
    modelo: value.modelo,
    tipo_camion: value.tipo_camion,
    estado_camion: value.estado_camion,
    conductor: value.conductor ? value.conductor.trim().toUpperCase() : null,
    velocidad: value.velocidad,

    // Se asigna el objeto GeoJSON directamente. 
    // Sequelize lo convertirá a formato binario de SQL Server automáticamente.
    ubicacion_geo: {
      type: 'Point',
      coordinates: value.ubicacion_geo.coordinates
    },

    codigoUsuarioCreacion: usuarioIngesta,
    fechaCreacion: fechaISO,
    codigoUsuarioModificacion: usuarioIngesta,
    fechaModificacion: fechaISO,
    ultima_actualizacion: fechaISO
  };
};

// 3. Modelo Sequelize: Limpio, sin lat/lon
const FlotaTerrestreDTOModel = (sequelize) => {
  return sequelize.define('TCL_CamionesOperaciones', {
    _id: { type: DataTypes.STRING(50), primaryKey: true, allowNull: false },
    placa: { type: DataTypes.STRING(10), allowNull: true },
    modelo: { type: DataTypes.INTEGER, allowNull: true },
    tipo_camion: { type: DataTypes.STRING(50), allowNull: true },
    estado_camion: { type: DataTypes.STRING(50), allowNull: true, defaultValue: 'EN_RUTA' },
    conductor: { type: DataTypes.STRING(100), allowNull: true },
    velocidad: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },

    // Homogeneidad espacial
    ubicacion_geo: {
      type: DataTypes.GEOMETRY('POINT', 4326),
      allowNull: true
    },

    ultima_actualizacion: { type: DataTypes.DATE, allowNull: true },
    codigoUsuarioCreacion: { type: DataTypes.STRING(200), allowNull: true },
    fechaCreacion: { type: DataTypes.STRING(100), allowNull: true },
    codigoUsuarioModificacion: { type: DataTypes.STRING(200), allowNull: true },
    fechaModificacion: { type: DataTypes.STRING(100), allowNull: true }
  }, {
    tableName: 'TCL_CamionesOperaciones',
    schema: 'dbo',
    timestamps: false
  });
};

module.exports = {
  FlotaTerrestreDTOModel,
  FlotaTerrestreDTO,
  FlotaTerrestreSchema
};