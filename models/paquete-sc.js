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

  // OT-029: foto del precio al vender (la calcula el API con la lista de precios; lo que mande la web se ignora)
  codigoLista: Joi.string().max(200).allow('', null).optional(),

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
    observaciones: (value.observaciones || '').trim(),
    fechaCancelacion: value.fechaCancelacion || null, // una licencia nueva no nace cancelada (OT-029)
    codigoLista: value.codigoLista || null,

    estadoLicencia: value.estadoLicencia,

    codigoUsuarioCreacion: value.codigoUsuarioCreacion,
    fechaCreacion: value.fechaCreacion || fechaActual,
    codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
    fechaModificacion: value.fechaModificacion || fechaActual
  };
};

const PaqueteSCModel = (sequelize) => {
  return sequelize.define('PTL_PaquetesSC', {
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
    // OT-029 (migración 036): foto del precio con el que se vendió
    codigoLista: { type: DataTypes.STRING(200), allowNull: true },
    moneda: { type: DataTypes.STRING(3), allowNull: true },
    periodicidad: { type: DataTypes.STRING(10), allowNull: true },
    mesesCobertura: { type: DataTypes.INTEGER, allowNull: true },
    valorPeriodo: { type: DataTypes.DECIMAL(18, 2), allowNull: true },
    precioSetup: { type: DataTypes.DECIMAL(18, 2), allowNull: true },
    porcentajeDescuento: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
    valorFinal: { type: DataTypes.DECIMAL(18, 2), allowNull: true },
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
    tableName: 'PTL_PaquetesSC',
    timestamps: false
  });
};

module.exports = {
  PaqueteSCModel,
  PaqueteSCDTO,
  PaqueteSCSchema
};