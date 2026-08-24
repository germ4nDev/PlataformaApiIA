/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization & Joi Validation
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const SuiteAPSchema = Joi.object({
  codigoAplicacion: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código de la aplicación es obligatorio.' }),

  codigoSuite: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código único de la suite es obligatorio.' }),

  nombreSuite: Joi.string().max(100).required()
    .messages({ 'any.required': 'El nombre comercial de la suite es obligatorio.' }),

  descripcionSuite: Joi.string().max(4000).allow('').required()
    .messages({ 'any.required': 'La descripción de la suite es obligatoria.' }),

  rutaInicio: Joi.string().max(100).allow('', null).optional().default('/'),

  translateKey: Joi.string().max(100).allow('', null).optional().default('SUITE_DEFAULT'),

  imagenInicio: Joi.string().max(100).allow('', null).optional().default('no-imagen.png'),

  estadoSuite: Joi.boolean().optional().default(true),

  codigoUsuarioCreacion: Joi.string().max(200).required(),
  fechaCreacion: Joi.string().max(100).required(),
  codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
  fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const SuiteAPDTO = (rawData) => {
  const { error, value } = SuiteAPSchema.validate(rawData, { abortEarly: false });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const fechaActual = new Date().toISOString();

  return {
    codigoAplicacion: value.codigoAplicacion.trim(),
    codigoSuite: value.codigoSuite.trim(),
    nombreSuite: value.nombreSuite.trim(),
    descripcionSuite: value.descripcionSuite.trim(),
    translateKey: value.translateKey.trim(),
    rutaInicio: value.rutaInicio.trim(),
    imagenInicio: value.imagenInicio.trim(),
    estadoSuite: value.estadoSuite,

    codigoUsuarioCreacion: value.codigoUsuarioCreacion,
    fechaCreacion: value.fechaCreacion || fechaActual,
    codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
    fechaModificacion: value.fechaModificacion || fechaActual
  };
};

const SuiteAPModel = (sequelize) => {
  return sequelize.define('PTLSuitesAP', {
    suiteId: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      allowNull: false
    },
    codigoAplicacion: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    codigoSuite: {
      type: DataTypes.STRING(200),
      primaryKey: true,
      allowNull: false
    },
    nombreSuite: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    descripcionSuite: {
      type: DataTypes.STRING(4000),
      allowNull: false
    },
    rutaInicio: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    translateKey: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    imagenInicio: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    estadoSuite: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
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
    tableName: 'PTLSuitesAP',
    timestamps: false
  });
};

module.exports = {
  SuiteAPModel,
  SuiteAPDTO,
  SuiteAPSchema
};