/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization & Strict Error Logging
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const LogTransaccionSchema = Joi.object({
  codigoAplicacion: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código de la aplicación es obligatorio.' }),

  codigoSuite: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código de la suite es obligatorio.' }),

  codigoModulo: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código del módulo es obligatorio.' }),

  codigoUsuario: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código del usuarios es obligatorio.' }),

  codigoError: Joi.string().max(100).optional().default('SIN_CODIGO'),

  fechaLog: Joi.string().max(50).optional().default(new Date().toISOString()),

  descripcionLog: Joi.string().max(2000).required()
    .messages({ 'any.required': 'La descripción o traza de la transacción es obligatoria.' }),

  codigoUsuarioCreacion: Joi.string().max(200).required(),
  fechaCreacion: Joi.string().max(100).required(),
  codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
  fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const LogTransaccionDTO = (rawData) => {
  const { error, value } = LogTransaccionSchema.validate(rawData, { abortEarly: false });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const fechaActual = new Date().toISOString();

  return {
    codigoAplicacion: value.codigoAplicacion.trim(),
    codigoSuite: value.codigoSuite.trim(),
    codigoModulo: value.codigoModulo.trim(),
    codigoUsuario: value.codigoUsuario,
    codigoError: value.codigoError.trim(),
    fechaLog: value.fechaLog || fechaActual,
    descripcionLog: value.descripcionLog.trim(),

    codigoUsuarioCreacion: value.codigoUsuarioCreacion,
    fechaCreacion: value.fechaCreacion || fechaActual,
    codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
    fechaModificacion: value.fechaModificacion || fechaActual
  };
};

const LogTransaccionModel = (sequelize) => {
  return sequelize.define('PTLLogTransaccionesAP', {
    logId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    codigoAplicacion: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    codigoSuite: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    codigoModulo: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    usuarioId: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false
    },
    codigoError: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    fechaLog: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    descripcionLog: {
      type: DataTypes.STRING(2000),
      allowNull: false
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
    tableName: 'PTLLogTransaccionesAP',
    timestamps: false
  });
};

module.exports = {
  LogTransaccionModel,
  LogTransaccionDTO,
  LogTransaccionSchema
};