/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization & Joi Validation
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const RoleAPSchema = Joi.object({
  codigoRole: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código del rol es obligatorio.' }),

  codigoAplicacion: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código de la aplicación es obligatorio.' }),

  codigoSuite: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código de la suite es obligatorio.' }),

  nombreRole: Joi.string().max(100).required()
    .messages({ 'any.required': 'El nombre del rol es obligatorio.' }),

  descripcionRole: Joi.string().max(4000).allow('').required()
    .messages({ 'any.required': 'La descripción del rol es obligatoria.' }),

  estadoRole: Joi.boolean().optional().default(true),

  codigoUsuarioCreacion: Joi.string().max(200).required(),
  fechaCreacion: Joi.string().max(100).required(),
  codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
  fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const RoleAPDTO = (rawData) => {
  const { error, value } = RoleAPSchema.validate(rawData, { abortEarly: false });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const fechaActual = new Date().toISOString();

  return {
    codigoRole: value.codigoRole.trim(),
    codigoAplicacion: value.codigoAplicacion.trim(),
    codigoSuite: value.codigoSuite.trim(),
    nombreRole: value.nombreRole.trim(),
    descripcionRole: value.descripcionRole.trim(),
    estadoRole: value.estadoRole,

    codigoUsuarioCreacion: value.codigoUsuarioCreacion,
    fechaCreacion: value.fechaCreacion || fechaActual,
    codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
    fechaModificacion: value.fechaModificacion || fechaActual
  };
};

const RoleAPModel = (sequelize) => {
  return sequelize.define('PTLRolesAP', {
    roleId: {
      type: DataTypes.INTEGER,
      autoIncrement: true
    },
    codigoRole: {
      type: DataTypes.STRING(200),
      primaryKey: true,
      allowNull: false
    },
    codigoAplicacion: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    codigoSuite: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    nombreRole: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    descripcionRole: {
      type: DataTypes.STRING(4000),
      allowNull: false
    },
    estadoRole: {
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
    tableName: 'PTLRolesAP',
    timestamps: false
  });
};

module.exports = {
  RoleAPModel,
  RoleAPDTO,
  RoleAPSchema
};