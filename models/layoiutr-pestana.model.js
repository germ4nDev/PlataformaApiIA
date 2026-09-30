/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization & Joi Validation
    Entity: PTLLayoutPestanas (Preferencias de orden y visibilidad de pestañas por usuario)
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

// 1. ESQUEMA DE VALIDACIÓN (JOI)
const LayoutPestanaSchema = Joi.object({
  codigoUsuario: Joi.string().max(200).required(),
  codigoPestana: Joi.string().max(100).required(),
  posicion: Joi.number().integer().min(0).required(),

  codigoUsuarioCreacion: Joi.string().max(200).allow('', null).optional(),
  fechaCreacion: Joi.string().max(100).allow('', null).optional(),
  codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
  fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

// 2. DATA TRANSFER OBJECT (DTO)
const LayoutPestanaDTO = (rawData) => {
  const { error, value } = LayoutPestanaSchema.validate(rawData, { abortEarly: false, stripUnknown: true });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const fechaActual = new Date().toISOString();

  return {
    codigoUsuario: value.codigoUsuario.trim(),
    codigoPestana: value.codigoPestana.trim(),
    posicion: value.posicion,
    codigoUsuarioCreacion: value.codigoUsuarioCreacion || value.codigoUsuario.trim(),
    fechaCreacion: value.fechaCreacion || fechaActual,
    codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuario.trim(),
    fechaModificacion: value.fechaModificacion || fechaActual
  };
};

// 3. MODELO SEQUELIZE
const LayoutPestanaModel = (sequelize) => {
  return sequelize.define('PTLLayoutPestanas', {
    layoutPestanaId: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false
    },
    codigoUsuario: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    codigoPestana: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    posicion: {
      type: DataTypes.INTEGER,
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
    tableName: 'PTLLayoutPestanas',
    timestamps: false
  });
};

module.exports = {
  LayoutPestanaModel,
  LayoutPestanaDTO,
  LayoutPestanaSchema
};