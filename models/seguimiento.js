/*
    Author: German Valencia
    Actualización: German Valencia / 20251109
    Refactored for: QPLUS DTO Pattern, Entity Standardization & Joi Validation
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const SeguimientoSchema = Joi.object({
  codigoSeguimiento: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código del seguimiento es obligatorio.' }),

  codigoTicket: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código del ticket relacionado es obligatorio.' }),

  codigoRequerimiento: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código del requerimiento relacionado es obligatorio.' }),

  nombreSeguimiento: Joi.string().max(100).required()
    .messages({ 'any.required': 'El nombre o título del seguimiento es obligatorio.' }),

  fechaSeguimiento: Joi.string().max(200).optional(),

  descripcionSeguimiento: Joi.string().max(2000).required()
    .messages({ 'any.required': 'La descripción del seguimiento es obligatoria.' }),

  estadoSeguimiento: Joi.string().max(100).optional().default('REGISTRADO'),

  estadoTicket: Joi.string().max(100).optional().default('EN_REVISION'),

  capturaSeguimiento: Joi.string().max(4000).allow('', null).optional().default('no-imagen.png'),

  codigoUsuarioCreacion: Joi.string().max(200).required(),
  fechaCreacion: Joi.string().max(100).required(),
  codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
  fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const SeguimientoDTO = (rawData) => {
  const { error, value } = SeguimientoSchema.validate(rawData, { abortEarly: false });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const fechaActual = new Date().toISOString();

  return {
    codigoSeguimiento: value.codigoSeguimiento.trim(),
    codigoTicket: value.codigoTicket.trim(),
    codigoRequerimiento: value.codigoRequerimiento.trim(),
    nombreSeguimiento: value.nombreSeguimiento.trim(),
    fechaSeguimiento: value.fechaSeguimiento || fechaActual,
    descripcionSeguimiento: value.descripcionSeguimiento.trim(),

    estadoSeguimiento: value.estadoSeguimiento.trim().toUpperCase(),
    estadoTicket: value.estadoTicket.trim().toUpperCase(),
    capturaSeguimiento: value.capturaSeguimiento || 'no-imagen.png',

    codigoUsuarioCreacion: value.codigoUsuarioCreacion,
    fechaCreacion: value.fechaCreacion || fechaActual,
    codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
    fechaModificacion: value.fechaModificacion || fechaActual
  };
};

const SeguimientoModel = (sequelize) => {
  return sequelize.define('PTLSeguimientosTK', {
    seguimientoId: {
      type: DataTypes.INTEGER,
      autoIncrement: true
    },
    codigoSeguimiento: {
      type: DataTypes.STRING(200),
      primaryKey: true,
      allowNull: false
    },
    codigoTicket: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    codigoRequerimiento: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    nombreSeguimiento: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    fechaSeguimiento: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    descripcionSeguimiento: {
      type: DataTypes.STRING(4000),
      allowNull: false
    },
    estadoSeguimiento: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: 'REGISTRADO'
    },
    estadoTicket: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: 'EN_REVISION'
    },
    capturaSeguimiento: {
      type: DataTypes.STRING(4000),
      allowNull: false,
      defaultValue: 'no-imagen.png'
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
    tableName: 'PTLSeguimientosTK',
    timestamps: false
  });
};

module.exports = {
  SeguimientoModel,
  SeguimientoDTO,
  SeguimientoSchema
};