/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization & Joi Validation
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const EnlaceSTSchema = Joi.object({
  codigoEnlace: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código del enlace es obligatorio.' }),

  codigoSitio: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código del sitio relacionado es obligatorio.' }),

  nombreEnlace: Joi.string().max(100).required()
    .messages({ 'any.required': 'El nombre del enlace es obligatorio.' }),

  descripcionEnlace: Joi.string().max(4000).required()
    .messages({ 'any.required': 'La descripción del enlace es obligatoria.' }),

  rutaEnlace: Joi.string().max(100).required()
    .messages({ 'any.required': 'La ruta o URL del enlace es obligatoria.' }),

  estadoEnlace: Joi.boolean().optional().default(true),

  codigoUsuarioCreacion: Joi.string().max(200).required(),
  fechaCreacion: Joi.string().max(100).required(),
  codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
  fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const EnlaceSTDTO = (rawData) => {
  const { error, value } = EnlaceSTSchema.validate(rawData, { abortEarly: false });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const fechaActual = new Date().toISOString();

  return {
    codigoEnlace: value.codigoEnlace.trim(),
    codigoSitio: value.codigoSitio.trim(),
    nombreEnlace: value.nombreEnlace.trim(),
    descripcionEnlace: value.descripcionEnlace.trim(),
    rutaEnlace: value.rutaEnlace.trim(),
    estadoEnlace: value.estadoEnlace,

    codigoUsuarioCreacion: value.codigoUsuarioCreacion,
    fechaCreacion: value.fechaCreacion || fechaActual,
    codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
    fechaModificacion: value.fechaModificacion || fechaActual
  };
};

const EnlaceSTModel = (sequelize) => {
  return sequelize.define('PTLEnlacesST', {
    enlaceId: {
      type: DataTypes.INTEGER,
      autoIncrement: true
    },
    codigoEnlace: {
      type: DataTypes.STRING(50),
      primaryKey: true,
      allowNull: false
    },
    codigoSitio: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    nombreEnlace: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    descripcionEnlace: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    rutaEnlace: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    estadoEnlace: {
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
    tableName: 'PTLEnlacesST',
    timestamps: false
  });
};

module.exports = {
  EnlaceSTModel,
  EnlaceSTDTO,
  EnlaceSTSchema
};