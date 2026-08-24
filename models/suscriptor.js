/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization & Joi Validation
*/
const Joi = require('joi');
const { DataTypes } = require("sequelize");

// 1. ESQUEMA DE VALIDACIÓN (Joi se encarga ahora del trim y el lowercase)
const SuscriptorSchema = Joi.object({
  codigoSuscriptor: Joi.string().trim().max(200).required()
    .messages({ 'any.required': 'El código único del suscriptor es obligatorio.' }),

  identificacionSuscriptor: Joi.string().trim().max(100).required()
    .messages({ 'any.required': 'La identificación (NIT/CC) del suscriptor es obligatoria.' }),

  nombreSuscriptor: Joi.string().trim().max(100).required()
    .messages({ 'any.required': 'El nombre o razón social del suscriptor es obligatorio.' }),

  correoSuscriptor: Joi.string().trim().email().lowercase().max(100).required() // Max 150 alineado con DB
    .messages({
      'any.required': 'El correo de contacto es obligatorio.',
      'string.email': 'Debe proporcionar un correo electrónico válido.'
    }),

  direccionSuscriptor: Joi.string().trim().max(200).allow('').optional().default(''),
  telefonoContacto: Joi.string().trim().max(100).allow('').optional().default(''),

  // Si codigoAdministrador es Foreign Key, el default correcto cuando no viene dato es null, no ''
  codigoAdministrador: Joi.string().trim().max(200).allow('', null).optional().default(null)
    .messages({ 'any.required': 'El código del administrador principal es obligatorio.' }),

  numeroEmpresas: Joi.number().integer().min(1).optional().default(1),
  numeroUsuarios: Joi.number().integer().min(1).optional().default(1),

  usuarioAdministrador: Joi.string().trim().max(100).allow('', null).optional().default(''),

  logoSuscriptor: Joi.string().trim().max(100).allow('', null).optional().default('no-imagen.png'),

  descripcionSuscriptor: Joi.string().trim().max(4000).allow('', null).optional().default(''),

  envioCorreosSuscriptor: Joi.boolean().optional().default(true),
  envioMensajesSuscriptor: Joi.boolean().optional().default(false),
  envioPublicidadSuscriptor: Joi.boolean().optional().default(false),

  estadoSuscriptor: Joi.boolean().optional().default(true),

  codigoUsuarioCreacion: Joi.string().trim().max(200).required(),
  fechaCreacion: Joi.string().trim().max(100).optional(), // Cambiado a opcional para que el DTO pueda generar la fecha si no viene
  codigoUsuarioModificacion: Joi.string().trim().max(200).allow('', null).optional(),
  fechaModificacion: Joi.string().trim().max(100).allow('', null).optional()
});

// 2. DATA TRANSFER OBJECT (DTO)
const SuscriptorDTO = (rawData) => {
  const { error, value } = SuscriptorSchema.validate(rawData, { abortEarly: false, stripUnknown: true });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const fechaActual = new Date().toISOString();

  // El DTO ahora es seguro porque Joi ya hizo el trim y manejó los nulls con sus defaults
  return {
    codigoSuscriptor: value.codigoSuscriptor,
    identificacionSuscriptor: value.identificacionSuscriptor,
    nombreSuscriptor: value.nombreSuscriptor,
    correoSuscriptor: value.correoSuscriptor,
    direccionSuscriptor: value.direccionSuscriptor,
    telefonoContacto: value.telefonoContacto,
    numeroEmpresas: value.numeroEmpresas,
    numeroUsuarios: value.numeroUsuarios,
    codigoAdministrador: value.codigoAdministrador,
    usuarioAdministrador: value.usuarioAdministrador,
    logoSuscriptor: value.logoSuscriptor,
    descripcionSuscriptor: value.descripcionSuscriptor,
    envioCorreosSuscriptor: value.envioCorreosSuscriptor,
    envioMensajesSuscriptor: value.envioMensajesSuscriptor,
    envioPublicidadSuscriptor: value.envioPublicidadSuscriptor,
    estadoSuscriptor: value.estadoSuscriptor,

    codigoUsuarioCreacion: value.codigoUsuarioCreacion,
    fechaCreacion: value.fechaCreacion || fechaActual,
    codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
    fechaModificacion: value.fechaModificacion || fechaActual
  };
};

// 3. MODELO SEQUELIZE
const SuscriptorModel = (sequelize) => {
  return sequelize.define("PTLSuscriptores", {
    suscriptorId: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      allowNull: false
    },
    codigoSuscriptor: {
      type: DataTypes.STRING(200),
      primaryKey: true,
      allowNull: false,
    },
    identificacionSuscriptor: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    nombreSuscriptor: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    correoSuscriptor: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    direccionSuscriptor: {
      type: DataTypes.STRING(200),
      allowNull: false, // <-- Actualizado para coincidir con el checkbox desmarcado de la BD
      defaultValue: ''  // <-- Evita errores si se omite en consultas directas
    },
    telefonoContacto: {
      type: DataTypes.STRING(100),
      allowNull: false, // <-- Actualizado para coincidir con el checkbox desmarcado de la BD
      defaultValue: ''
    },
    numeroEmpresas: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    numeroUsuarios: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    codigoAdministrador: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    usuarioAdministrador: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    logoSuscriptor: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    descripcionSuscriptor: {
      type: DataTypes.STRING(4000),
      allowNull: true,
    },
    envioCorreosSuscriptor: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    envioMensajesSuscriptor: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    envioPublicidadSuscriptor: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    estadoSuscriptor: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    codigoUsuarioCreacion: {
      type: DataTypes.STRING(200),
      allowNull: true
    },
    fechaCreacion: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    codigoUsuarioModificacion: {
      type: DataTypes.STRING(200),
      allowNull: true
    },
    fechaModificacion: {
      type: DataTypes.STRING(100),
      allowNull: true
    }
  }, {
    tableName: "PTLSuscriptores",
    timestamps: false, // Manejado manualmente en el DTO
  });
};

module.exports = {
  SuscriptorModel,
  SuscriptorDTO,
  SuscriptorSchema
};