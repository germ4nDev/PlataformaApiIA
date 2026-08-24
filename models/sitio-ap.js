/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization & Joi Validation
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const SitioAPSchema = Joi.object({
  codigoSitio: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código del sitio es obligatorio.' }),

  codigoAplicacion: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código de la aplicación es obligatorio.' }),

  nombreSitio: Joi.string().max(100).required()
    .messages({ 'any.required': 'El nombre del sitio es obligatorio.' }),

  // Permitimos string vacío en la API, pero requerido en payload para la base de datos
  descripcionSitio: Joi.string().max(4000).allow('').required()
    .messages({ 'any.required': 'La descripción del sitio es obligatoria.' }),

  urlSitio: Joi.string().max(100).optional().default('http://localhost'),

  puertoSitio: Joi.number().integer().min(1).max(65535).optional().default(80)
    .messages({ 'number.max': 'El puerto no puede ser superior a 65535.' }),

  estadoSitio: Joi.boolean().optional().default(true),

  codigoUsuarioCreacion: Joi.string().max(200).required(),
  fechaCreacion: Joi.string().max(100).required(),
  codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
  fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const SitioAPDTO = (rawData) => {
  const { error, value } = SitioAPSchema.validate(rawData, { abortEarly: false });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const fechaActual = new Date().toISOString();

  return {
    codigoSitio: value.codigoSitio.trim(),
    codigoAplicacion: value.codigoAplicacion.trim(),
    nombreSitio: value.nombreSitio.trim(),
    descripcionSitio: value.descripcionSitio.trim(),
    urlSitio: value.urlSitio.trim(),
    puertoSitio: value.puertoSitio,
    estadoSitio: value.estadoSitio,

    codigoUsuarioCreacion: value.codigoUsuarioCreacion,
    fechaCreacion: value.fechaCreacion || fechaActual,
    codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
    fechaModificacion: value.fechaModificacion || fechaActual
  };
};

const SitioAPModel = (sequelize) => {
  return sequelize.define('PTLSitiosAP', {
    sitioId: {
      type: DataTypes.INTEGER,
      autoIncrement: true
    },
    codigoSitio: {
      type: DataTypes.STRING(200),
      primaryKey: true,
      allowNull: false
    },
    codigoAplicacion: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    nombreSitio: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    descripcionSitio: {
      type: DataTypes.STRING(4000),
      allowNull: false
    },
    urlSitio: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: 'http://localhost'
    },
    estadoSitio: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    puertoSitio: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 80
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
    tableName: 'PTLSitiosAP',
    timestamps: false
  });
};

module.exports = {
  SitioAPModel,
  SitioAPDTO,
  SitioAPSchema
};