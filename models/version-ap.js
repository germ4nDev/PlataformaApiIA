/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization & Joi Validation
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const VersionAPSchema = Joi.object({
  codigoVersion: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código único de la versión es obligatorio.' }),

  codigoAplicacion: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código de la aplicación es obligatorio.' }),

  nombreVersion: Joi.string().max(100).required()
    .messages({ 'any.required': 'El nombre comercial de la versión es obligatorio.' }),

  version: Joi.string().max(100).required()
    .messages({ 'any.required': 'El número de versión (ej. 1.0.0) es obligatorio.' }),

  fechaVersion: Joi.string().max(100).optional(new Date().toISOString()),

  descripcionVersion: Joi.string().max(4000).allow('').required()
    .messages({ 'any.required': 'La descripción de los cambios es obligatoria.' }),

  estadoVersion: Joi.boolean().optional().default(true),

  codigoUsuarioCreacion: Joi.string().max(200).required(),
  fechaCreacion: Joi.string().max(100).required(),
  codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
  fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const VersionAPDTO = (rawData) => {
  const { error, value } = VersionAPSchema.validate(rawData, { abortEarly: false });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const fechaActual = new Date().toISOString();

  return {
    codigoVersion: value.codigoVersion.trim(),
    codigoAplicacion: value.codigoAplicacion.trim(),
    nombreVersion: value.nombreVersion.trim(),
    version: value.version.trim(),
    fechaVersion: value.fechaVersion || fechaActual,
    descripcionVersion: value.descripcionVersion.trim(),
    estadoVersion: value.estadoVersion,

    codigoUsuarioCreacion: value.codigoUsuarioCreacion,
    fechaCreacion: value.fechaCreacion || fechaActual,
    codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
    fechaModificacion: value.fechaModificacion || fechaActual
  };
};

const VersionAPModel = (sequelize) => {
  return sequelize.define('PTLVersionesAP', {
    versionId: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      allowNull: false
    },
    codigoVersion: {
      type: DataTypes.STRING(50),
      primaryKey: true,
      allowNull: false
    },
    codigoAplicacion: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    fechaVersion: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    nombreVersion: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    version: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    descripcionVersion: {
      type: DataTypes.STRING(1000),
      allowNull: false
    },
    estadoVersion: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false
    },
    codigoUsuarioCreacion: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    fechaCreacion: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    codigoUsuarioModificacion: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    fechaModificacion: {
      type: DataTypes.STRING(50),
      allowNull: false
    }
  }, {
    tableName: 'PTLVersionesAP',
    timestamps: false
  });
};

module.exports = {
  VersionAPModel,
  VersionAPDTO,
  VersionAPSchema
};