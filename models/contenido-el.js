/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization & Joi Validation
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const ContenidoSchema = Joi.object({
  codigoContenido: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código del contenido es obligatorio.' }),

  codigoEnlace: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código del enlace relacionado es obligatorio.' }),

  nombreContenido: Joi.string().max(100).required()
    .messages({ 'any.required': 'El nombre del contenido es obligatorio.' }),

  descripcionContenido: Joi.string().max(4000).allow('', null).optional(),

  contenido: Joi.string().max(5000).required()
    .messages({ 'any.required': 'El cuerpo del contenido es obligatorio.' }),

  estadoContenido: Joi.boolean().optional().default(true),

  codigoUsuarioCreacion: Joi.string().max(200).required(),
  fechaCreacion: Joi.string().max(100).required(),
  codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
  fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const ContenidoDTO = (rawData) => {
  const { error, value } = ContenidoSchema.validate(rawData, { abortEarly: false });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const fechaActual = new Date().toISOString();

  return {
    codigoContenido: value.codigoContenido.trim(),
    codigoEnlace: value.codigoEnlace.trim(),
    nombreContenido: value.nombreContenido.trim(),
    descripcionContenido: value.descripcionContenido || '',
    contenido: value.contenido, // No hacemos trim forzado por si preserva sangrías o código de maquetación
    estadoContenido: value.estadoContenido,

    codigoUsuarioCreacion: value.codigoUsuarioCreacion,
    fechaCreacion: value.fechaCreacion || fechaActual,
    codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
    fechaModificacion: value.fechaModificacion || fechaActual
  };
};

const ContenidoModel = (sequelize) => {
  return sequelize.define('PTLContenidosEL', {
    contenidoId: {
      type: DataTypes.INTEGER,
      autoIncrement: true
    },
    codigoContenido: {
      type: DataTypes.STRING(50),
      primaryKey: true,
      allowNull: false
    },
    codigoEnlace: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    nombreContenido: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    descripcionContenido: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    contenido: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    estadoContenido: {
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
    tableName: 'PTLContenidosEL',
    timestamps: false
  });
};

module.exports = {
  ContenidoModel,
  ContenidoDTO,
  ContenidoSchema
};