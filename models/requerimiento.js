/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization & Joi Validation
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const RequerimientoSchema = Joi.object({
  codigoRequerimiento: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código del requerimiento es obligatorio.' }),

  codigoTicket: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código del ticket relacionado es obligatorio.' }),

  nombreRequerimiento: Joi.string().max(100).required()
    .messages({ 'any.required': 'El nombre del requerimiento es obligatorio.' }),

  descripcionRequerimiento: Joi.string().max(4000).required()
    .messages({ 'any.required': 'La descripción detallada del requerimiento es obligatoria.' }),

  estadoRequerimiento: Joi.string().max(50).optional().default('PENDIENTE'),

  codigoUsuarioCreacion: Joi.string().max(200).required(),
  fechaCreacion: Joi.string().max(100).required(),
  codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
  fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const RequerimientoDTO = (rawData) => {
  const { error, value } = RequerimientoSchema.validate(rawData, { abortEarly: false });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const fechaActual = new Date().toISOString();

  return {
    codigoRequerimiento: value.codigoRequerimiento.trim(),
    codigoTicket: value.codigoTicket.trim(),
    nombreRequerimiento: value.nombreRequerimiento.trim(),
    descripcionRequerimiento: value.descripcionRequerimiento.trim(),
    estadoRequerimiento: value.estadoRequerimiento.trim().toUpperCase(), // Estandarizamos estados a mayúsculas

    codigoUsuarioCreacion: value.codigoUsuarioCreacion,
    fechaCreacion: value.fechaCreacion || fechaActual,
    codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
    fechaModificacion: value.fechaModificacion || fechaActual
  };
};

const RequerimientoModel = (sequelize) => {
  return sequelize.define('PTLRequerimientosTK', {
    requerimientoId: {
      type: DataTypes.INTEGER,
      autoIncrement: true
    },
    codigoRequerimiento: {
      type: DataTypes.STRING(50),
      primaryKey: true,
      allowNull: false
    },
    codigoTicket: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    nombreRequerimiento: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    descripcionRequerimiento: {
      type: DataTypes.STRING(1000),
      allowNull: false
    },
    estadoRequerimiento: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'PENDIENTE'
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
    tableName: 'PTLRequerimientosTK',
    timestamps: false
  });
};

module.exports = {
  RequerimientoModel,
  RequerimientoDTO,
  RequerimientoSchema
};