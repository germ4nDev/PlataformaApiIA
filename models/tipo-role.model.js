const { DataTypes } = require('sequelize');
const Joi = require('joi');

const TipoRoleSchema = Joi.object({
  codigoTipoRole: Joi.string().max(200).required().messages({
    'string.empty': 'El código del tipo de rol no puede estar vacío.',
    'any.required': 'El código del tipo de rol es un campo obligatorio.'
  }),
  nombreTipoRole: Joi.string().max(100).required().messages({
    'string.empty': 'El nombre del tipo de rol no puede estar vacío.',
    'any.required': 'El nombre del tipo de rol es un campo obligatorio.'
  }),
  descripcionTipoRole: Joi.string().max(4000).allow('', null),
  estadoTipoRole: Joi.boolean().default(true),
  codigoUsuarioCreacion: Joi.string().max(200).required().messages({
    'any.required': 'El código del usuario creador es obligatorio.'
  }),
  codigoUsuarioModificacion: Joi.string().max(200).allow('', null)
})

const TipoRoleDTO = (rawData) => {
  const { error, value } = TipoPagoSchema.validate(rawData, { abortEarly: false });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const fechaActual = new Date().toISOString();

  return {
    tipoRoleId: data.tipoRoleId,
    codigoTipoRole: data.codigoTipoRole.trim(),
    nombreTipoRole: data.nombreTipoRole.trim().toUpperCase(),
    descripcionTipoRole: data.descripcionTipoRole.trim(),
    estadoTipoRole: data.estadoTipoRole,
    codigoUsuarioCreacion: data.codigoUsuarioCreacion,
    fechaCreacion: data.fechaCreacion || fechaActual,
    codigoUsuarioModificacion: data.codigoUsuarioModificacion,
    fechaModificacion: data.fechaModificacion || fechaActual
  };
};

const TipoRoleModel = (sequelize) => {
  return sequelize.define('PTLTiposRole', {
    tipoRoleId: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      allowNull: false
    },
    codigoTipoRole: {
      type: DataTypes.STRING(200),
      primaryKey: true,
      allowNull: false
    },
    nombreTipoRole: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    descripcionTipoRole: {
      type: DataTypes.STRING(4000)
    },
    estadoTipoRole: {
      type: DataTypes.BOOLEAN,
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
    tableName: 'PTLTiposRole',
    timestamps: false
  });
};

module.exports = { TipoRoleModel, TipoRoleDTO, TipoRoleSchema };