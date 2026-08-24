/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization, Duplicity Fix & Joi Validation
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const TipoLogSchema = Joi.object({
  codigoTipoLog: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código único del tipo de log es obligatorio.' }),

  nombreTipo: Joi.string().max(100).required()
    .messages({ 'any.required': 'El nombre del tipo de log es obligatorio.' }),

  descripcionTipo: Joi.string().max(4000).allow('').required()
    .messages({ 'any.required': 'La descripción del tipo de log es obligatoria.' }),

  codigoRespuesta: Joi.string().max(50).optional().default('200'),

  estadoTipo: Joi.boolean().optional().default(true),

  codigoUsuarioCreacion: Joi.string().max(200).required(),
  fechaCreacion: Joi.string().max(100).required(),
  codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
  fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const TipoLogDTO = (rawData) => {
  const { error, value } = TipoLogSchema.validate(rawData, { abortEarly: false });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const fechaActual = new Date().toISOString();

  return {
    codigoTipoLog: value.codigoTipoLog.trim(),
    nombreTipo: value.nombreTipo.trim(),
    descripcionTipo: value.descripcionTipo.trim(),
    codigoRespuesta: value.codigoRespuesta.trim(),
    estadoTipo: value.estadoTipo,

    codigoUsuarioCreacion: value.codigoUsuarioCreacion,
    fechaCreacion: value.fechaCreacion || fechaActual,
    codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
    fechaModificacion: value.fechaModificacion || fechaActual
  };
};

const TipoLogModel = (sequelize) => {
  return sequelize.define('PTLTiposLogs', {
    tipoLogId: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      allowNull: false
    },
    codigoTipoLog: {
      type: DataTypes.STRING(50),
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
    codigoRespuesta: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: '200'
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
    tableName: 'PTLTiposLogs',
    timestamps: false
  });
};

module.exports = {
  TipoLogModel,
  TipoLogDTO,
  TipoLogSchema
};