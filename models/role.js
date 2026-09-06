const Joi = require('joi');
const { DataTypes } = require('sequelize');

// 1. ESQUEMA JOI CORREGIDO
const RoleAPSchema = Joi.object({
  codigoRole: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código del rol es obligatorio.' }),
  codigoTipoRole: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código del tipo de role es obligatorio.' }),
  nombreRole: Joi.string().max(100).required()
    .messages({ 'any.required': 'El nombre del rol es obligatorio.' }),

  codigoAplicacion: Joi.string().max(200).allow('', null).optional(),
  codigoSuite: Joi.string().max(200).allow('', null).optional(),
  descripcionRole: Joi.string().max(4000).allow('', null).optional(),
  estadoRole: Joi.boolean().optional().default(true),

  codigoUsuarioCreacion: Joi.string().max(200).allow('', null).optional(),
  fechaCreacion: Joi.string().max(100).allow('', null).optional(),
  codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
  fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const RoleAPDTO = (rawData) => {
  const { error, value } = RoleAPSchema.validate(rawData, { abortEarly: false, stripUnknown: true });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const fechaActual = new Date().toISOString();

  return {
    codigoRole: value.codigoRole.trim(),
    codigoTipoRole: value.codigoTipoRole.trim(),
    codigoAplicacion: value.codigoAplicacion ? value.codigoAplicacion.trim() : null,
    codigoSuite: value.codigoSuite ? value.codigoSuite.trim() : null,
    nombreRole: value.nombreRole.trim(),
    descripcionRole: value.descripcionRole ? value.descripcionRole.trim() : null,
    estadoRole: value.estadoRole ?? true,

    codigoUsuarioCreacion: value.codigoUsuarioCreacion || null,
    fechaCreacion: value.fechaCreacion || fechaActual,
    codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion || null,
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
    codigoTipoRole: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    codigoAplicacion: {
      type: DataTypes.STRING(200),
      allowNull: true
    },
    codigoSuite: {
      type: DataTypes.STRING(200),
      allowNull: true
    },
    nombreRole: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    descripcionRole: {
      type: DataTypes.STRING(4000),
      allowNull: true
    },
    estadoRole: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
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
    tableName: 'PTLRolesAP',
    timestamps: false
  });
};

module.exports = { RoleAPModel, RoleAPDTO, RoleAPSchema };