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
  codigoUsuarioModificacion: Joi.string().max(200).allow('', null),
  // CC-141: la web manda las fechas de auditoría y el DTO las usa; antes «"fechaModificacion" is not allowed»
  fechaCreacion: Joi.string().max(100).allow('', null).optional(),
  fechaModificacion: Joi.string().max(100).allow('', null).optional()
})

const TipoRoleDTO = (rawData) => {
  const { error, value } = TipoRoleSchema.validate(rawData, { abortEarly: false });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const fechaActual = new Date().toISOString();

  return {
    tipoRoleId: value.tipoRoleId,
    codigoTipoRole: value.codigoTipoRole.trim(),
    nombreTipoRole: value.nombreTipoRole.trim().toUpperCase(),
    descripcionTipoRole: value.descripcionTipoRole.trim(),
    estadoTipoRole: value.estadoTipoRole,
    codigoUsuarioCreacion: value.codigoUsuarioCreacion,
    fechaCreacion: value.fechaCreacion || fechaActual,
    codigoUsuarioModificacion: value.codigoUsuarioModificacion,
    fechaModificacion: value.fechaModificacion || fechaActual
  };
};

const TipoRoleModel = (sequelize) => {
  return sequelize.define('PTL_TiposRole', {
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
    tableName: 'PTL_TiposRole',
    timestamps: false
  });
};

module.exports = { TipoRoleModel, TipoRoleDTO, TipoRoleSchema };