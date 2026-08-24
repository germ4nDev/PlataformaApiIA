/*
    Author: John Castañeda
    Refactored by: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization & Joi Validation
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const ServidorSchema = Joi.object({
  codigoServidor: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código del servidor es obligatorio.' }),

  nombreServidor: Joi.string().max(100).required()
    .messages({ 'any.required': 'El nombre del servidor es obligatorio.' }),

  descripcionServidor: Joi.string().max(4000).allow('').required()
    .messages({ 'any.required': 'La descripción del servidor es obligatoria.' }),

  rutaServidor: Joi.string().max(100).allow('', null).optional().default('/'),

  direccionIP: Joi.string().ip({ version: ['ipv4', 'ipv6'] }).allow('', null).optional().default('0.0.0.0')
    .messages({ 'string.ip': 'La dirección IP proporcionada no tiene un formato válido.' }),

  estadoServidor: Joi.boolean().optional().default(true),

  codigoUsuarioCreacion: Joi.string().max(200).required(),
  fechaCreacion: Joi.string().max(100).required(),
  codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
  fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const ServidorDTO = (rawData) => {
  const { error, value } = ServidorSchema.validate(rawData, { abortEarly: false });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const fechaActual = new Date().toISOString();

  return {
    codigoServidor: value.codigoServidor.trim(),
    nombreServidor: value.nombreServidor.trim(),
    descripcionServidor: value.descripcionServidor.trim(),
    rutaServidor: value.rutaServidor.trim(),
    direccionIP: value.direccionIP.trim(),
    estadoServidor: value.estadoServidor,

    codigoUsuarioCreacion: value.codigoUsuarioCreacion,
    fechaCreacion: value.fechaCreacion || fechaActual,
    codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
    fechaModificacion: value.fechaModificacion || fechaActual
  };
};

const ServidorModel = (sequelize) => {
  return sequelize.define('PTLServidor', {
    servidorId: {
      type: DataTypes.INTEGER,
      autoIncrement: true
    },
    codigoServidor: {
      type: DataTypes.STRING(200),
      primaryKey: true,
      allowNull: false
    },
    nombreServidor: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    descripcionServidor: {
      type: DataTypes.STRING(4000),
      allowNull: false
    },
    rutaServidor: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    direccionIP: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    estadoServidor: {
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
    tableName: 'PTLServidor',
    timestamps: false
  });
};

module.exports = {
  ServidorModel,
  ServidorDTO,
  ServidorSchema
};