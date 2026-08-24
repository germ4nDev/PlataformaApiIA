/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, RBAC Standardization, Clean Code & Joi Validation
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const UsuarioRoleSchema = Joi.object({
  codigoUsuarioRole: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código único de la asignación de rol es obligatorio.' }),

  codigoUsuarioSC: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código del usuario es obligatorio.' }),

  codigoEmpresaSC: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código de la empresa (tenant) es obligatorio.' }),

  codigoRole: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código del rol a asignar es obligatorio.' }),

  estadoUsuarioRole: Joi.boolean().optional().default(true),

  codigoUsuarioCreacion: Joi.string().max(200).required(),
  fechaCreacion: Joi.string().max(100).required(),
  codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
  fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const UsuarioRoleDTO = (rawData) => {
  const { error, value } = UsuarioRoleSchema.validate(rawData, { abortEarly: false });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const fechaActual = new Date().toISOString();

  return {
    codigoUsuarioRole: value.codigoUsuarioRole.trim(),
    codigoUsuarioSC: value.codigoUsuarioSC.trim(),
    codigoEmpresaSC: value.codigoEmpresaSC.trim(),
    codigoRole: value.codigoRole.trim(),
    estadoUsuarioRole: value.estadoUsuarioRole,

    codigoUsuarioCreacion: value.codigoUsuarioCreacion,
    fechaCreacion: value.fechaCreacion || fechaActual,
    codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
    fechaModificacion: value.fechaModificacion || fechaActual
  };
};

const UsuarioRoleModel = (sequelize) => {
  return sequelize.define('PTLUsuariosRole', {
    usuarioRoleId: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      allowNull: false
    },
    codigoUsuarioRole: {
      type: DataTypes.STRING(200),
      primaryKey: true,
      allowNull: false
    },
    codigoUsuarioSC: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    codigoEmpresaSC: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    codigoRole: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    estadoUsuarioRole: {
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
    tableName: 'PTLUsuariosRole',
    timestamps: false
  });
};

module.exports = {
  UsuarioRoleModel,
  UsuarioRoleDTO,
  UsuarioRoleSchema
};