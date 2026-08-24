/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization & Joi Validation
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const EstadoSchema = Joi.object({
  codigoTipoEstado: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código del estado de multimedia es obligatorio.' }),

  nombreEstado: Joi.string().max(100).required()
    .messages({ 'any.required': 'El nombre del estado es obligatorio.' }),

  siglaEstado: Joi.string().max(10).required()
    .messages({ 'any.required': 'La sigla del estado es obligatoria.' }),

  codigoUsuarioCreacion: Joi.string().max(200).required(),
  fechaCreacion: Joi.string().max(100).required(),
  codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
  fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const EstadoDTO = (rawData) => {
  const { error, value } = EstadoSchema.validate(rawData, { abortEarly: false });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const fechaActual = new Date().toISOString();

  return {
    codigoTipoEstado: value.codigoTipoEstado,
    tipoEstado: value.tipoEstado,
    nombreEstado: value.nombreEstado.trim(),
    siglaEstado: value.siglaEstado.trim().toUpperCase(), // Estandarización estricta a mayúsculas

    codigoUsuarioCreacion: value.codigoUsuarioCreacion,
    fechaCreacion: value.fechaCreacion || fechaActual,
    codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
    fechaModificacion: value.fechaModificacion || fechaActual
  };
};

const EstadoModel = (sequelize) => {
  return sequelize.define('PTLEstados', {
    estadoId: {
      type: DataTypes.INTEGER,
      autoIncrement: true
    },
    codigoTipoEstado: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false
    },
    nombreEstado: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    siglaEstado: {
      type: DataTypes.STRING(10),
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
    tableName: 'PTLEstados',
    timestamps: false
  });
};

module.exports = {
  EstadoModel,
  EstadoDTO,
  EstadoSchema
};