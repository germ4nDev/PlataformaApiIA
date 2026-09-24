/*
    Author: German Valencia
    Pattern: PORTTOS DTO Pattern - Clima Pronóstico y Observado
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

// 1. Schema de validación
const ClimaPronosticoSchema = Joi.object({
  idEstacion: Joi.number().integer().required(),
  zona: Joi.string().max(150).trim().required(),
  temp: Joi.number().precision(2).required(),
  viento: Joi.number().precision(2).required(),
  presion: Joi.number().precision(2).required(),
  tipoDato: Joi.string().valid('OBSERVADO', 'PRONOSTICO').required(),
  fechaRegistro: Joi.date().iso().required()
});

// 2. DTO Constructor
const ClimaPronosticoDTO = (rawData, userContext = { codigoUsuario: 'CRON_CLIMA_SYS' }) => {
  const { error, value } = ClimaPronosticoSchema.validate(rawData, { abortEarly: false, stripUnknown: true });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const fechaISO = new Date().toISOString();
  const usuarioIngesta = userContext.codigoUsuario;

  return {
    id_estacion: value.idEstacion,
    zona: value.zona.toUpperCase(),
    temp: value.temp,
    viento: value.viento,
    presion: value.presion,
    tipo_dato: value.tipoDato,
    fecha_registro: value.fechaRegistro,

    codigoUsuarioCreacion: usuarioIngesta,
    fechaCreacion: fechaISO,
    codigoUsuarioModificacion: usuarioIngesta,
    fechaModificacion: fechaISO
  };
};

// 3. Modelo Sequelize
const ClimaPronosticoModel = (sequelize) => {
  return sequelize.define('TCL_Clima_Pronostico', {
    id_registro: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    id_estacion: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    zona: {
      type: DataTypes.STRING(150),
      allowNull: false
    },
    temp: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false
    },
    viento: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false
    },
    presion: {
      type: DataTypes.DECIMAL(7, 2),
      allowNull: false
    },
    tipo_dato: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    fecha_registro: {
      type: DataTypes.DATE,
      allowNull: false
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
    tableName: 'TCL_Clima_Pronostico',
    schema: 'dbo',
    timestamps: false
  });
};

module.exports = { ClimaPronosticoModel, ClimaPronosticoDTO, ClimaPronosticoSchema };