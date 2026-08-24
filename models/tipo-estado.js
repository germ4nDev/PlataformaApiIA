/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization, Bug Fix & Joi Validation
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const TipoEstadoSchema = Joi.object({
  codigoTipoEstado: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código único del tipo de estado es obligatorio.' }),

  tipoEstado: Joi.number().integer().optional().default(0),

  nombreTipo: Joi.string().max(100).required()
    .messages({ 'any.required': 'El nombre del tipo de estado es obligatorio.' }),

  descripcionEstado: Joi.string().max(4000).allow('').required()
    .messages({ 'any.required': 'La descripción del estado es obligatoria.' }),

  estado: Joi.boolean().optional().default(true),

  codigoUsuarioCreacion: Joi.string().max(200).required(),
  fechaCreacion: Joi.string().max(100).required(),
  codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
  fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const TipoEstadoDTO = (rawData) => {
  const { error, value } = TipoEstadoSchema.validate(rawData, { abortEarly: false });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const fechaActual = new Date().toISOString();

  return {
    codigoTipoEstado: value.codigoTipoEstado.trim(),
    tipoEstado: value.tipoEstado,
    nombreTipo: value.nombreTipo.trim(),
    descripcionEstado: value.descripcionEstado.trim(),
    estado: value.estado,

    codigoUsuarioCreacion: value.codigoUsuarioCreacion,
    fechaCreacion: value.fechaCreacion || fechaActual,
    codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
    fechaModificacion: value.fechaModificacion || fechaActual
  };
};

const TipoEstadoModel = (sequelize) => {
  return sequelize.define('PTLTiposEstados', {
    tipoEstadoId: {
      type: DataTypes.INTEGER,
      autoIncrement: true
    },
    codigoTipoEstado: {
      type: DataTypes.STRING(50),
      primaryKey: true,
      allowNull: false
    },
    tipoEstado: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false
    },
    nombreTipo: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    descripcionEstado: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    estado: {
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
    tableName: 'PTLTiposEstados',
    timestamps: false
  });
};

module.exports = {
  TipoEstadoModel,
  TipoEstadoDTO,
  TipoEstadoSchema
};