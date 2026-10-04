/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Primary Key Standardization & Joi Validation
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const TipoPaqueteSchema = Joi.object({
  codigoTipoPaquete: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código del tipo de paquete es obligatorio.' }),

  nombreTipoPaquete: Joi.string().max(100).required()
    .messages({ 'any.required': 'El nombre del tipo de paquete es obligatorio.' }),

  descripcionTipo: Joi.string().max(4000).allow('', null).optional().default(''),
  numMeses: Joi.number().required()
    .messages({ 'any.required': 'El numero de meses de cobertura del tipo de paquete es obligatorio.' }),
  descuentoMeses: Joi.number().required()
    .messages({ 'any.required': 'El descuento mensual del tipo de paquete es obligatorio.' }),

  estadoTipo: Joi.boolean().optional().default(true),

  // Campos de auditoría (Permiten nulos)
  codigoUsuarioCreacion: Joi.string().max(200).allow('', null).optional(),
  fechaCreacion: Joi.string().max(100).allow('', null).optional(),
  codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
  fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const TipoPaqueteDTO = (rawData) => {
  const { error, value } = TipoPaqueteSchema.validate(rawData, { abortEarly: false });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const fechaActual = new Date().toISOString();

  return {
    codigoTipoPaquete: value.codigoTipoPaquete.trim(),
    nombreTipoPaquete: value.nombreTipoPaquete.trim().toUpperCase(),
    descripcionTipo: value.descripcionTipo ? value.descripcionTipo.trim() : '',
    numMeses: value.numMeses,
    descuentoMeses: value.descuentoMeses,
    estadoTipo: value.estadoTipo,

    codigoUsuarioCreacion: value.codigoUsuarioCreacion,
    fechaCreacion: value.fechaCreacion || fechaActual,
    codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
    fechaModificacion: value.fechaModificacion || fechaActual
  };
};

const TipoPaqueteModel = (sequelize) => {
  return sequelize.define('PTLTiposPaquete', {
    tipoPaqueteId: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      allowNull: false
    },
    codigoTipoPaquete: {
      type: DataTypes.STRING(200),
      primaryKey: true,
      allowNull: false
    },
    nombreTipoPaquete: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    descripcionTipo: {
      type: DataTypes.STRING(4000),
      allowNull: true
    },
    numMeses: {
      type: DataTypes.NUMBER,
      allowNull: false
    },
    descuentoMeses: {
      type: DataTypes.NUMBER,
      allowNull: false
    },
    estadoTipo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
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
    tableName: 'PTLTiposPaquete', // El nombre de tu nueva tabla en SQL Server
    timestamps: false
  });
};

module.exports = {
  TipoPaqueteModel,
  TipoPaqueteDTO,
  TipoPaqueteSchema
};