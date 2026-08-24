/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Strict Audit Log & Joi Validation
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const LogActividadSchema = Joi.object({
  codigoAplicacion: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código de la aplicación es obligatorio para trazar el log.' }),

  codigoSuite: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código de la suite es obligatorio.' }),

  codigoModulo: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código del módulo es obligatorio.' }),

  codigoTipoLog: Joi.string().max(200).required()
    .messages({ 'any.required': 'El tipo de log (ej: ERROR, INFO, WARN) es obligatorio.' }),

  codigoRespuesta: Joi.string().max(50).required()
    .messages({ 'any.required': 'El código de respuesta de la operación es obligatorio.' }),

  descripcionLog: Joi.string().max(4000).allow('', null).optional(),

  fechaLog: Joi.string().max(50).optional().default(new Date().toISOString()),

  codigoUsuarioCreacion: Joi.string().max(200).required(),
  fechaCreacion: Joi.string().max(100).required(),
  codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
  fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const LogActividadDTO = (rawData) => {
  const { error, value } = LogActividadSchema.validate(rawData, { abortEarly: false });

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
    codigoTipoLog: value.codigoTipoLog.trim(),
    codigoRespuesta: value.codigoRespuesta.trim(),
    descripcionLog: value.descripcionLog || '',

    fechaLog: value.fechaLog || fechaActual,

    codigoUsuarioCreacion: value.codigoUsuarioCreacion,
    fechaCreacion: value.fechaCreacion || fechaActual
  };
};

const LogActividadModel = (sequelize) => {
  return sequelize.define('PTLLogActividadesAP', {
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
    codigoTipoLog: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    codigoRespuesta: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    fechaLog: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    descripcionLog: {
      type: DataTypes.STRING(1000),
      allowNull: true
    },
    codigoUsuarioCreacion: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    fechaCreacion: {
      type: DataTypes.STRING(100),
      allowNull: false
    }
  }, {
    tableName: 'PTLLogActividadesAP',
    timestamps: false
  });
};

module.exports = {
  LogActividadModel,
  LogActividadDTO,
  LogActividadSchema
};