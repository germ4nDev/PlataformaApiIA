/*
    Author: German Valencia
    Pattern: QPLUS DTO Pattern - Flota Terrestre Última Posición Conocida
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

// 1. Esquema de Validación Ajustado a la Nueva Tabla
const FlotaTerrestreSchema = Joi.object({
  _id: Joi.string().max(50).required(), // ID proveniente de MongoDB
  placa: Joi.string().max(10).required(),
  modelo: Joi.number().integer().min(1900).max(2100).optional(),
  tipo_camion: Joi.string().max(50).optional(),
  estado_camion: Joi.string().valid('EN_RUTA', 'DETENIDO', 'MANTENIMIENTO', 'DESCARGANDO', 'DETENIDO_POR_TRAFICO').default('EN_RUTA'),
  conductor: Joi.string().max(100).allow('', null).optional(),
  lat: Joi.number().min(-90).max(90).required(),
  lon: Joi.number().min(-180).max(180).required(),
  velocidad: Joi.number().min(0).default(0)
});

// 2. DTO: Formatea los datos y construye el objeto Espacial (Point) para SQL Server
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

    // Sequelize formatea las inserciones espaciales usando el estándar GeoJSON
    ubicacion_geo: {
      type: 'Point',
      coordinates: [value.lon, value.lat] // MapLibre y SQL Server usan siempre [Longitud, Latitud]
    },

    // Campos de Auditoría QPLUS
    codigoUsuarioCreacion: usuarioIngesta,
    fechaCreacion: fechaISO,
    codigoUsuarioModificacion: usuarioIngesta,
    fechaModificacion: fechaISO,
    ultima_actualizacion: fechaISO
  };
};

// 3. Modelo Sequelize conectado a la tabla importada de MongoDB
const FlotaTerrestreDTOModel = (sequelize) => {
  return sequelize.define('TCL_CamionesOperaciones', {
    _id: {
      type: DataTypes.STRING(50), // Cambiado a STRING para soportar el ObjectId de Mongo
      primaryKey: true,
      allowNull: false
    },
    placa: {
      type: DataTypes.STRING(10),
      allowNull: true
    },
    modelo: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    tipo_camion: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    estado_camion: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: 'EN_RUTA'
    },
    conductor: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    velocidad: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    // Definición nativa de campos espaciales
    ubicacion_geo: {
      type: DataTypes.GEOMETRY('POINT', 4326),
      allowNull: true
    },
    punto_destino: {
      type: DataTypes.GEOMETRY('POINT', 4326),
      allowNull: true
    },
    ultima_actualizacion: {
      type: DataTypes.DATE, // O DataTypes.STRING si prefieres mantener tu formato actual
      allowNull: true
    },
    // Auditoría
    codigoUsuarioCreacion: {
      type: DataTypes.STRING(200),
      allowNull: true
    },
    fechaCreacion: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    codigoUsuarioModificacion: {
      type: DataTypes.STRING(200),
      allowNull: true
    },
    fechaModificacion: {
      type: DataTypes.STRING(100),
      allowNull: true
    }
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