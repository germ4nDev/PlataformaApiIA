/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Primary Key Standardization & Joi Validation
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const PaqueteSCSchema = Joi.object({
  codigoSuscriptorPaquete: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código único de la relación Suscriptor-Paquete es obligatorio.' }),

  codigoSuscriptor: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código del suscriptor es obligatorio.' }),

  codigoPaquete: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código del paquete es obligatorio.' }),
  codigoTipoPaquete: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código Tipo paquete es obligatorio.' }),

  codigoLicencia: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código de la licencia es obligatorio.' }),

  numRenovaciones: Joi.number().min(0).required(),
  fechaInicio: Joi.string().max(100).required(),
  fechaProximoPago: Joi.string().max(100).required(),
  fechaRenovacion: Joi.string().max(100).required(),
  observaciones: Joi.string().max(4000).allow('', null).optional(),
  fechaCancelacion: Joi.string().max(100).allow('', null).optional(),

  estadoLicencia: Joi.boolean().optional().default(true),

  codigoUsuarioCreacion: Joi.string().max(200).allow('', null).optional(),
  fechaCreacion: Joi.string().max(100).allow('', null).optional(),
  codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
  fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const PaqueteSCDTO = (rawData) => {
  const { error, value } = PaqueteSCSchema.validate(rawData, { abortEarly: false });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const fechaActual = new Date().toISOString();

  return {
    codigoSuscriptorPaquete: value.codigoSuscriptorPaquete.trim(),
    codigoSuscriptor: value.codigoSuscriptor.trim(),
    codigoPaquete: value.codigoPaquete.trim(),
    codigoTipoPaquete: value.codigoTipoPaquete.trim(),
    codigoLicencia: value.codigoLicencia.trim(),
    numRenovaciones: value.numRenovaciones ?? 0,
    fechaInicio: value.fechaInicio || fechaActual,
    fechaProximoPago: value.fechaProximoPago || fechaActual,
    fechaRenovacion: value.fechaRenovacion || fechaActual,
    observaciones: value.observaciones.trim(),
    fechaCancelacion: value.fechaCancelacion || fechaActual,

    estadoLicencia: value.estadoLicencia,

    codigoUsuarioCreacion: value.codigoUsuarioCreacion,
    fechaCreacion: value.fechaCreacion || fechaActual,
    codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
    fechaModificacion: value.fechaModificacion || fechaActual
  };
};

const PaqueteSCModel = (sequelize) => {
  return sequelize.define('PTLPaquetesSC', {
    paqueteSCId: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      allowNull: false
    },
    codigoSuscriptorPaquete: {
      type: DataTypes.STRING(200),
      primaryKey: true,
      allowNull: false
    },
    codigoSuscriptor: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    codigoPaquete: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    codigoTipoPaquete: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    codigoLicencia: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    fechaInicio: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    fechaProximoPago: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    fechaRenovacion: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    numRenovaciones: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false
    },
    observaciones: {
      type: DataTypes.STRING(1000),
      allowNull: true
    },
    fechaCancelacion: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    estadoLicencia: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false
    },
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
    tableName: 'PTLPaquetesSC',
    timestamps: false
  });
};

module.exports = {
  PaqueteSCModel,
  PaqueteSCDTO,
  PaqueteSCSchema
};