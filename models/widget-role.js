/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization, Joi Validation & SQL Server precision
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const WidgetRoleSchema = Joi.object({
  codigoWidgetRole: Joi.string().max(200).required(),
  codigoWidget: Joi.string().max(200).required(),
  codigoRol: Joi.string().max(200).required(),
  estadoRelacion: Joi.boolean().optional().default(true),

  // 🟢 Campos de auditoría estándar QPLUS
  codigoUsuarioCreacion: Joi.string().max(200).required(),
  fechaCreacion: Joi.string().max(100).required(),
  codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
  fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const WidgetRoleDTO = (rawData) => {
  const { error, value } = WidgetRoleSchema.validate(rawData, { abortEarly: false, stripUnknown: true });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const fechaActual = new Date().toISOString();

  return {
    codigoWidgetRole: value.codigoWidgetRole.trim(),
    codigoWidget: value.codigoWidget.trim(),
    codigoRole: value.codigoRol.trim(),
    estadoRelacion: value.estadoRelacion,

    codigoUsuarioCreacion: value.codigoUsuarioCreacion,
    fechaCreacion: value.fechaCreacion || fechaActual,
    codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
    fechaModificacion: value.fechaModificacion || fechaActual
  };
};

const WidgetRoleModel = (sequelize) => {
  return sequelize.define('PTLWidgetsRoles', {
    idRelacion: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    codigoWidgetRole: { type: DataTypes.STRING(200), allowNull: false },
    codigoWidget: { type: DataTypes.STRING(200), allowNull: false },
    codigoRole: { type: DataTypes.STRING(200), allowNull: false },

    estadoRelacion: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },

    codigoUsuarioCreacion: { type: DataTypes.STRING(200), allowNull: true },
    fechaCreacion: { type: DataTypes.STRING(100), allowNull: true },
    codigoUsuarioModificacion: { type: DataTypes.STRING(200), allowNull: true },
    fechaModificacion: { type: DataTypes.STRING(100), allowNull: true }
  }, {
    tableName: 'PTLWidgetsRoles',
    timestamps: false
  });
};

module.exports = {
  WidgetRoleModel,
  WidgetRoleDTO,
  WidgetRoleSchema
};