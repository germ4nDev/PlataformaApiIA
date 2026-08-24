/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization & Joi Validation
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const ItemSchema = Joi.object({
  codigoItem: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código del ítem es obligatorio.' }),

  codigoTipoItem: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código del tipo de item es obligatorio.' }),

  nombreItem: Joi.string().max(100).required()
    .messages({ 'any.required': 'El nombre del ítem es obligatorio.' }),

  valorItem: Joi.number().integer().min(0).optional().default(0),

  costoItem: Joi.number().integer().min(0).optional().default(0),

  descripcionItem: Joi.string().max(400).allow('').required()
    .messages({ 'any.required': 'La descripción del valor es obligatoria.' }),

  estadoItem: Joi.boolean().optional().default(true),

  codigoUsuarioCreacion: Joi.string().max(200).required(),
  fechaCreacion: Joi.string().max(100).required(),
  codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
  fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const ItemDTO = (rawData) => {
  const { error, value } = ItemSchema.validate(rawData, { abortEarly: false });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const fechaActual = new Date().toISOString();

  return {
    codigoItem: value.codigoItem.trim(),
    codigoTipoItem: value.codigoTipoItem,
    nombreItem: value.nombreItem.trim(),
    valorItem: value.valorUnitario,
    costoItem: value.costoItem,
    descripcionItem: value.descripcionItem.trim(),
    estadoItem: value.estadoItem,

    codigoUsuarioCreacion: value.codigoUsuarioCreacion,
    fechaCreacion: value.fechaCreacion || fechaActual,
    codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
    fechaModificacion: value.fechaModificacion || fechaActual
  };
};

const ItemModel = (sequelize) => {
  return sequelize.define('PTLItems', {
    itemId: {
      type: DataTypes.INTEGER,
      autoIncrement: true
    },
    codigoItem: {
      type: DataTypes.STRING(50),
      primaryKey: true,
      allowNull: false
    },
    codigoTipoItem: {
      type: DataTypes.STRING,
      allowNull: false
    },
    nombreItem: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    valorUnitario: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    costoItem: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    descripcionItem: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    estadoItem: {
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
    tableName: 'PTLItems',
    timestamps: false
  });
};

module.exports = {
  ItemModel,
  ItemDTO,
  ItemSchema
};