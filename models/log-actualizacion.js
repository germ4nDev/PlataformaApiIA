/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization & Joi Validation
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const LogActualizacionSchema = Joi.object({
  codigoAplicacion: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código de la aplicación es obligatorio.' }),

  codigoVersion: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código de la versión de actualización es obligatorio.' }),

  fechaLog: Joi.date().iso().optional().default(new Date().toISOString()),

  descripcionLog: Joi.string().max(4000).required()
    .messages({ 'any.required': 'La descripción detallada del log es obligatoria.' }),

  codigoUsuario: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código del usuarios es obligatorio.' }),

  codigoUsuarioCreacion: Joi.string().max(200).required(),
  fechaCreacion: Joi.string().max(100).required(),
  codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
  fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const LogActualizacionDTO = (rawData) => {
  const { error, value } = LogActualizacionSchema.validate(rawData, { abortEarly: false });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const fechaActualISO = new Date().toISOString();
  const fechaTransaccion = value.fechaLog ? new Date(value.fechaLog) : new Date();

  return {
    codigoAplicacion: value.codigoAplicacion.trim(),
    codigoVersion: value.codigoVersion.trim(),
    fechaLog: fechaTransaccion,
    descripcionLog: value.descripcionLog.trim(),
    codigoUsuario: value.codigoUsuario.trim(),

    codigoUsuarioCreacion: value.codigoUsuarioCreacion,
    fechaCreacion: value.fechaCreacion || fechaActual,
    codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
    fechaModificacion: value.fechaModificacion || fechaActual
  };
};

const LogActualizacionModel = (sequelize) => {
  return sequelize.define('PTLLogActualizacionesAP', {
    logId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    codigoAplicacion: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    codigoVersion: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    fechaLog: {
      type: DataTypes.DATE,
      allowNull: false
    },
    descripcionLog: {
      type: DataTypes.STRING(4000),
      allowNull: false
    },
    codigoUsuario: {
      type: DataTypes.STRING(200),
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
    tableName: 'PTLLogActualizacionesAP',
    timestamps: false
  });
};

module.exports = {
  LogActualizacionModel,
  LogActualizacionDTO,
  LogActualizacionSchema
};