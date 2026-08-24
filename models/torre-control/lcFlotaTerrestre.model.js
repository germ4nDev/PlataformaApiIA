/*
    Author: German Valencia
    Pattern: QPLUS DTO Pattern - Flota Terrestre Última Posición Conocida
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const FlotaTerrestreSchema = Joi.object({
  placa: Joi.string().max(20).required(),
  estado: Joi.string().valid('ACTIVO', 'EN_RUTA', 'DETENIDO', 'MANTENIMIENTO').default('ACTIVO'),
  conductor: Joi.string().max(100).allow('', null).optional(),
  lat: Joi.number().min(-90).max(90).required(),
  lon: Joi.number().min(-180).max(180).required(),
  velocidad: Joi.number().min(0).default(0)
});

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
    placa: value.placa.trim().toUpperCase(),
    estado: value.estado,
    conductor: value.conductor ? value.conductor.trim().toUpperCase() : null,
    latitud: value.lat,
    longitud: value.lon,
    velocidad: value.velocidad,

    codigoUsuarioCreacion: usuarioIngesta,
    fechaCreacion: fechaISO,
    codigoUsuarioModificacion: usuarioIngesta,
    fechaModificacion: fechaISO
  };
};

const TLCFlotaTerrestreModel = (sequelize) => {
  return sequelize.define('TLCFlotaTerrestre', {
    id_vehiculo: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    placa: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    estado: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: 'ACTIVO'
    },
    conductor: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    latitud: {
      type: DataTypes.DECIMAL(10, 6),
      allowNull: true
    },
    longitud: {
      type: DataTypes.DECIMAL(10, 6),
      allowNull: true
    },
    velocidad: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    codigoUsuarioCreacion: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    fechaCreacion: {
      type: DataTypes.STRING(100),
      allowNull: false
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
    tableName: 'TLCFlotaTerrestre',
    schema: 'dbo',
    timestamps: false
  });
};

module.exports = { TLCFlotaTerrestreModel, FlotaTerrestreDTO, FlotaTerrestreSchema };