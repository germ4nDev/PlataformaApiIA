/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Primary Key Standardization & Joi Validation
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const TipoPagoSchema = Joi.object({
  codigoTipoPago: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código del tipo de pago es obligatorio.' }),

  nombreTipoPago: Joi.string().max(100).required()
    .messages({ 'any.required': 'El nombre del tipo de pago es obligatorio.' }),

  descripcionTipo: Joi.string().max(4000).allow('', null).optional().default(''),

  estadoTipo: Joi.boolean().optional().default(true),

  // Campos de auditoría (Permiten nulos según la BD)
  codigoUsuarioCreacion: Joi.string().max(200).allow('', null).optional(),
  fechaCreacion: Joi.string().max(100).allow('', null).optional(),
  codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
  fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const TipoPagoDTO = (rawData) => {
  const { error, value } = TipoPagoSchema.validate(rawData, { abortEarly: false });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const fechaActual = new Date().toISOString();

  return {
    codigoTipoPago: value.codigoTipoPago.trim(),
    nombreTipoPago: value.nombreTipoPago.trim().toUpperCase(), // Normalizamos a mayúsculas
    descripcionTipo: value.descripcionTipo ? value.descripcionTipo.trim() : '',
    estadoTipo: value.estadoTipo,

    codigoUsuarioCreacion: value.codigoUsuarioCreacion,
    fechaCreacion: value.fechaCreacion || fechaActual,
    codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
    fechaModificacion: value.fechaModificacion || fechaActual
  };
};

const TipoPagoModel = (sequelize) => {
  return sequelize.define('PTLTiposPago', {
    tipoPagoId: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      allowNull: false
    },
    codigoTipoPago: {
      type: DataTypes.STRING(200),
      primaryKey: true,
      allowNull: false
    },
    nombreTipoPago: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    descripcionTipo: {
      type: DataTypes.STRING(4000),
      allowNull: true // Check marcado en la BD
    },
    estadoTipo: {
      type: DataTypes.BOOLEAN,
      allowNull: false, // Check desmarcado en la BD
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
    tableName: 'PTLTiposPago',
    timestamps: false
  });
};

module.exports = {
  TipoPagoModel,
  TipoPagoDTO,
  TipoPagoSchema
};