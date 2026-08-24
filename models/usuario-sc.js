/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization, Variable Collision Fix & Joi Validation
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const UsuarioSCSchema = Joi.object({
  codigoUsuarioSC: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código único de la vinculación Usuario-Suscriptor es obligatorio.' }),

  codigoUsuario: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código del usuario a vincular es obligatorio.' }),

  codigoSuscriptor: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código del suscriptor (Tenant) es obligatorio.' }),

  estadoUsuarioSC: Joi.boolean().optional().default(true),

  codigoUsuarioCreacion: Joi.string().max(200).required(),
  fechaCreacion: Joi.string().max(100).required(),
  codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
  fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const UsuarioSCDTO = (rawData) => {
  const { error, value } = UsuarioSCSchema.validate(rawData, { abortEarly: false });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const fechaActual = new Date().toISOString();

  return {
    codigoUsuarioSC: value.codigoUsuarioSC.trim(),
    codigoUsuario: value.codigoUsuario.trim(),
    codigoSuscriptor: value.codigoSuscriptor.trim(),
    estadoUsuarioSC: value.estadoUsuarioSC,

    codigoUsuarioCreacion: value.codigoUsuarioCreacion,
    fechaCreacion: value.fechaCreacion || fechaActual,
    codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
    fechaModificacion: value.fechaModificacion || fechaActual
  };
};

const UsuarioSCModel = (sequelize) => {
  return sequelize.define('PTLUsuariosSC', {
    usuarioSCId: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      allowNull: false
    },
    codigoUsuarioSC: {
      type: DataTypes.STRING(200),
      primaryKey: true,
      allowNull: false
    },
    codigoUsuario: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    codigoSuscriptor: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    estadoUsuarioSC: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
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
    tableName: 'PTLUsuariosSC',
    timestamps: false
  });
};

module.exports = {
  UsuarioSCModel,
  UsuarioSCDTO,
  UsuarioSCSchema
};