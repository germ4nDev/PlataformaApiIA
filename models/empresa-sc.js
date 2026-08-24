/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization & Joi Validation
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const EmpresaSCSchema = Joi.object({
  codigoEmpresaSC: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código de la empresa es obligatorio.' }),

  codigoSuscriptor: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código del suscriptor es obligatorio.' }),

  nombreEmpresa: Joi.string().max(100).required()
    .messages({ 'any.required': 'El nombre de la empresa es obligatorio.' }),

  descripcionEmpresa: Joi.string().max(4000).required()
    .messages({ 'any.required': 'La descripción de la empresa es obligatoria.' }),

  estadoEmpresa: Joi.boolean().optional().default(true),

  logoEmpresa: Joi.string().max(100).allow('', null).optional().default('no-imagen.png'),

  codigoUsuarioCreacion: Joi.string().max(200).required(),
  fechaCreacion: Joi.string().max(100).required(),
  codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
  fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const EmpresaSCDTO = (rawData) => {
  const { error, value } = EmpresaSCSchema.validate(rawData, { abortEarly: false });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const fechaActual = new Date().toISOString();

  return {
    codigoEmpresaSC: value.codigoEmpresaSC.trim(),
    codigoSuscriptor: value.codigoSuscriptor.trim(),
    nombreEmpresa: value.nombreEmpresa.trim(),
    descripcionEmpresa: value.descripcionEmpresa.trim(),
    estadoEmpresa: value.estadoEmpresa,
    logoEmpresa: value.logoEmpresa || 'no-imagen.png',

    codigoUsuarioCreacion: value.codigoUsuarioCreacion,
    fechaCreacion: value.fechaCreacion || fechaActual,
    codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
    fechaModificacion: value.fechaModificacion || fechaActual
  };
};

const EmpresaSCModel = (sequelize) => {
  return sequelize.define('PTLEmpresasSC', {
    empresaId: {
      type: DataTypes.INTEGER,
      autoIncrement: true
    },
    codigoEmpresaSC: {
      type: DataTypes.STRING(50),
      primaryKey: true,
      allowNull: false
    },
    codigoSuscriptor: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    nombreEmpresa: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    descripcionEmpresa: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    estadoEmpresa: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    logoEmpresa: {
      type: DataTypes.STRING(255),
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
    tableName: 'PTLEmpresasSC',
    timestamps: false
  });
};

module.exports = {
  EmpresaSCModel,
  EmpresaSCDTO,
  EmpresaSCSchema
};