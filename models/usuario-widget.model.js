const Joi = require('joi');
const { DataTypes } = require('sequelize');

const UsuarioWidgetSchema = Joi.object({
  id: Joi.number().integer().optional(),
  codigoUsuario: Joi.string().max(200).required(),
  codigoWidget: Joi.string().max(200).required(),
  pestana: Joi.string().max(100).allow('', null).optional().default('TAB_PLAT_PRINCIPAL'),
  cols: Joi.number().integer().allow(null).optional().default(4),
  rows: Joi.number().integer().allow(null).optional().default(3),
  x: Joi.number().integer().allow(null).optional().default(0),
  y: Joi.number().integer().allow(null).optional().default(0),
  visible: Joi.boolean().allow(null).optional().default(true),
  codigoUsuarioCreacion: Joi.string().max(200).allow(null, '').optional(),
  fechaCreacion: Joi.string().max(100).allow(null, '').optional()
});

const UsuarioWidgetDTO = (rawData) => {
  const { error, value } = UsuarioWidgetSchema.validate(rawData, { abortEarly: false, stripUnknown: true });

  if (error) {
    throw { type: 'ValidationError', details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message })) };
  }

  return {
    codigoUsuario: value.codigoUsuario.trim(),
    codigoWidget: value.codigoWidget.trim(),
    pestana: value.pestana || 'TAB_PLAT_PRINCIPAL',
    cols: value.cols ?? 4,
    rows: value.rows ?? 3,
    x: value.x ?? 0,
    y: value.y ?? 0,
    visible: value.visible ?? true,
    codigoUsuarioCreacion: value.codigoUsuarioCreacion || null,
    fechaCreacion: value.fechaCreacion || null
  };
};

const UsuarioWidgetModel = (sequelize) => {
  return sequelize.define('PTLUsuarioWidgets', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    codigoUsuario: { type: DataTypes.STRING(200), allowNull: false },
    codigoWidget: { type: DataTypes.STRING(200), allowNull: false },
    pestana: { type: DataTypes.STRING(100), allowNull: true },
    cols: { type: DataTypes.INTEGER, allowNull: true },
    rows: { type: DataTypes.INTEGER, allowNull: true },
    x: { type: DataTypes.INTEGER, allowNull: true },
    y: { type: DataTypes.INTEGER, allowNull: true },
    visible: { type: DataTypes.BOOLEAN, allowNull: true },
    codigoUsuarioCreacion: { type: DataTypes.STRING(200), allowNull: true },
    fechaCreacion: { type: DataTypes.STRING(100), allowNull: true },
    codigoUsuarioModificacion: { type: DataTypes.STRING(200), allowNull: true },
    fechaModificacion: { type: DataTypes.STRING(100), allowNull: true }
  }, {
    tableName: 'PTLUsuarioWidgets',
    timestamps: false
  });
};

module.exports = {
  UsuarioWidgetModel,
  UsuarioWidgetDTO,
  UsuarioWidgetSchema
};