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

  descripcionTipo: Joi.string().max(4000).allow('', null).optional(),

  iconoTipo: Joi.string().max(100).allow('', null).optional(),

  estadoTipo: Joi.boolean().optional().default(true),

  codigoUsuarioCreacion: Joi.string().max(200).allow('', null).optional(),
  fechaCreacion: Joi.string().max(100).allow('', null).optional(),
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
    descripcionTipo: value.descripcionTipo ? value.descripcionTipo.trim() : null,
    iconoTipo: value.iconoTipo ? value.iconoTipo.trim() : null,
    estadoTipo: value.estadoTipo,

    codigoUsuarioCreacion: value.codigoUsuarioCreacion || null,
    fechaCreacion: value.fechaCreacion || fechaActual,
    codigoUsuarioModificacion: value.codigoUsuarioModificacion || null,
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
      type: DataTypes.STRING(4000),
      allowNull: true
    },
    iconoTipo: {
      type: DataTypes.STRING(100),
      allowNull: true
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
    tableName: 'PTLTiposItem',
    timestamps: false
  });
};

module.exports = {
  TipoItemModel,
  TipoItemDTO,
  TipoItemSchema
};