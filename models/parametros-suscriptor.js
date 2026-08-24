/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization & Joi Validation
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const ParametrosSuscriptorSchema = Joi.object({
  codigoParametro: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código del parametro es obligatorio.' }),

  codigoSuscriptor: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código del suscriptor es obligatorio.' }),

  prefijoFactura: Joi.string().max(20).required()
    .messages({ 'any.required': 'El prefijo de la facturacion es obligatorio.' }),

  numeroCeros: Joi.number().integer().required()
    .messages({
      'any.required': 'El numero de ceros es obligatorio.',
      'number.base': 'El numero de ceros debe ser un número válido.'
    }),

  codigoUsuarioCreacion: Joi.string().max(200).required(),
  fechaCreacion: Joi.string().max(100).required(),
  codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
  fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const ParametrosSuscriptorDTO = (rawData) => {
  const { error, value } = ParametroSuscriptorSchema.validate(rawData, { abortEarly: false });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const fechaActual = new Date().toISOString();

  return {
    codigoParametro: value.codigoParametro.trim(),
    codigoSuscriptor: value.codigoSuscriptor.trim(),
    prefijoFactura: value.prefijoFactura.trim(),
    numeroCeros: value.numeroCeros,

    codigoUsuarioCreacion: value.codigoUsuarioCreacion,
    fechaCreacion: value.fechaCreacion || fechaActual,
    codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
    fechaModificacion: value.fechaModificacion || fechaActual
  };
};

const ParametrosSuscriptorModel = (sequelize) => {
  return sequelize.define('PTLParametrosSuscriptor', {
    parametroId: {
      type: DataTypes.INTEGER,
      autoIncrement: true
    },
    codigoParametro: {
      type: DataTypes.STRING(200),
      primaryKey: true,
      allowNull: false
    },
    codigoSuscriptor: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    prefijoFactura: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    numeroCeros: {
      type: DataTypes.INTEGER,
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
      allowNull: false
    },
    fechaModificacion: {
      type: DataTypes.STRING(100),
      allowNull: false
    }
  }, {
    tableName: 'PTLParametrosSuscriptor',
    timestamps: false
  });
};

module.exports = {
  ParametrosSuscriptorModel,
  ParametrosSuscriptorDTO,
  ParametrosSuscriptorSchema
};