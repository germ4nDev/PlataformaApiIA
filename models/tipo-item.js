/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization, Update Fix & Joi Validation
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const TipoItemSchema = Joi.object({
  codigoTipoItem: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código único del tipo de item es obligatorio.' }),

  nombreTipo: Joi.string().max(100).required()
    .messages({ 'any.required': 'El nombre del tipo de ítem es obligatorio.' }),

  descripcionTipo: Joi.string().max(4000).allow('').required()
    .messages({ 'any.required': 'La descripción del tipo de ítem es obligatoria.' }),

  estadoTipo: Joi.boolean().optional().default(true),

  codigoUsuarioCreacion: Joi.string().max(200).required(),
  fechaCreacion: Joi.string().max(100).required(),
  codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
  fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const TipoItemDTO = (rawData) => {
  const { error, value } = TipoItemSchema.validate(rawData, { abortEarly: false });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const fechaActual = new Date().toISOString();

  return {
    codigoTipoItem: value.codigoTipoItem.trim(),
    nombreTipo: value.nombreTipo.trim(),
    descripcionTipo: value.descripcionTipo.trim(),
    estadoTipo: value.estadoTipo,

    codigoUsuarioCreacion: value.codigoUsuarioCreacion,
    fechaCreacion: value.fechaCreacion || fechaActual,
    codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
    fechaModificacion: value.fechaModificacion || fechaActual
  };
};

const TipoItemModel = (sequelize) => {
  return sequelize.define('PTLTiposItem', {
    tipoItemId: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      allowNull: false
    },
    codigoTipoItem: {
      type: DataTypes.STRING(200),
      primaryKey: true,
      allowNull: false
    },
    nombreTipo: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    descripcionTipo: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    estadoTipo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
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
    tableName: 'PTLTiposItem',
    timestamps: false
  });
};

module.exports = {
  TipoItemModel,
  TipoItemDTO,
  TipoItemSchema
};