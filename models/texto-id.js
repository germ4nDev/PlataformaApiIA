/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization (i18n) & Joi Validation
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const TextoIDSchema = Joi.object({
  codigoTexto: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código único del texto es obligatorio.' }),

  idiomaId: Joi.number().integer().positive().required()
    .messages({ 'any.required': 'El ID del idioma es obligatorio para asociar la traducción.' }),

  anclaTexto: Joi.string().max(100).required()
    .messages({ 'any.required': 'El ancla o clave del texto (ej. TITULO_PRINCIPAL) es obligatoria.' }),

  textoValor: Joi.string().max(4000).allow('', null).optional().default(''),

  estadoTexto: Joi.boolean().optional().default(true),

  codigoUsuarioCreacion: Joi.string().max(200).required(),
  fechaCreacion: Joi.string().max(100).required(),
  codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
  fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const TextoIDDTO = (rawData) => {
  const { error, value } = TextoIDSchema.validate(rawData, { abortEarly: false });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const fechaActual = new Date().toISOString();

  return {
    codigoTexto: value.codigoTexto,
    codigoIdioma: value.codigoIdioma,
    anclaTexto: value.anclaTexto.trim().toUpperCase(),
    textoValor: value.textoValor.trim(),
    estadoTexto: value.estadoTexto,

    codigoUsuarioCreacion: value.codigoUsuarioCreacion,
    fechaCreacion: value.fechaCreacion || fechaActual,
    codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
    fechaModificacion: value.fechaModificacion || fechaActual
  };
};

const TextoIDModel = (sequelize) => {
  return sequelize.define('PTLTextosID', {
    textoId: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      allowNull: false
    },
    codigoTexto: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false
    },
    idiomaId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    anclaTexto: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    textoValor: {
      type: DataTypes.STRING(4000),
      allowNull: false
    },
    estadoTexto: {
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
    tableName: 'PTLTextosID',
    timestamps: false
  });
};

module.exports = {
  TextoIDModel,
  TextoIDDTO,
  TextoIDSchema
};