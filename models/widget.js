/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization, Joi Validation & SQL Server precision
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const WidgetMaestroSchema = Joi.object({
  codigoWidget: Joi.string().max(200).required(),
  nombreWidget: Joi.string().max(150).required(),
  descripcionWidget: Joi.string().max(4000).allow('', null).optional().default(''),
  imagenWidget_light: Joi.string().max(100).allow('', null).optional().default('no-widget.png'),
  imagenWidget_dark: Joi.string().max(100).allow('', null).optional().default('no-widget.png'),
  defaultCols: Joi.number().integer().min(1).max(12).required().default(4),
  defaultRows: Joi.number().integer().min(1).required().default(3),
  pos_x: Joi.number().integer().min(0).required().default(0),
  pos_y: Joi.number().integer().min(0).required().default(0), tipo: Joi.string().max(50).allow('', null).optional().default('indefinido'),
  pestana: Joi.string().max(100).allow('', null).optional().default('TAB_PLAT_PRINCIPAL'),
  layoutVersion: Joi.number().integer().min(1).required(),
  inicial: Joi.boolean().required().default(false),
  estadoWidget: Joi.boolean().required().default(true),

  codigoUsuarioCreacion: Joi.string().max(200).allow('', null).optional(),
  fechaCreacion: Joi.string().max(100).allow('', null).optional(),
  codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
  fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const WidgetMaestroDTO = (rawData) => {
  const { error, value } = WidgetMaestroSchema.validate(rawData, { abortEarly: false, stripUnknown: true });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const fechaActual = new Date().toISOString();

  return {
    codigoWidget: value.codigoWidget.trim().toUpperCase(),
    nombreWidget: value.nombreWidget.trim(),
    descripcionWidget: value.descripcionWidget ? value.descripcionWidget.trim() : '',
    imagenWidget_light: value.imagenWidget_light ? value.imagenWidget_light.trim() : 'no-widget.png',
    imagenWidget_dark: value.imagenWidget_dark ? value.imagenWidget_dark.trim() : 'no-widget.png',

    defaultCols: value.defaultCols,
    defaultRows: value.defaultRows,
    pos_x: value.pos_x,
    pos_y: value.pos_y,
    tipo: value.tipo,
    pestana: value.pestana,
    layoutVersion: value.layoutVersion,
    inicial: value.inicial,
    estadoWidget: value.estadoWidget,

    codigoUsuarioCreacion: value.codigoUsuarioCreacion,
    fechaCreacion: value.fechaCreacion || fechaActual,
    codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
    fechaModificacion: value.fechaModificacion || fechaActual
  };
};

const WidgetMaestroModel = (sequelize) => {
  return sequelize.define('PTLWidgetsMaestro', {
    widgetId: { type: DataTypes.INTEGER, autoIncrement: true },
    codigoWidget: { type: DataTypes.STRING(200), primaryKey: true, allowNull: false },
    nombreWidget: { type: DataTypes.STRING(150), allowNull: false },
    descripcionWidget: { type: DataTypes.STRING(4000), allowNull: true, defaultValue: '' },
    imagenWidget_light: { type: DataTypes.STRING(100), allowNull: true, defaultValue: 'no-widget.png' },
    imagenWidget_dark: { type: DataTypes.STRING(100), allowNull: true, defaultValue: 'no-widget.png' },

    defaultCols: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 4 },
    defaultRows: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 3 },
    pos_x: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    pos_y: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    tipo: { type: DataTypes.STRING(50), allowNull: true, defaultValue: 'indefinido' },
    pestana: { type: DataTypes.STRING(100), allowNull: true, defaultValue: 'TAB_PLAT_PRINCIPAL' },
    layoutVersion: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    inicial: { type: DataTypes.BOOLEAN, defaultValue: false },
    estadoWidget: { type: DataTypes.BOOLEAN, defaultValue: true },

    codigoUsuarioCreacion: { type: DataTypes.STRING(200), allowNull: true },
    fechaCreacion: { type: DataTypes.STRING(100), allowNull: true },
    codigoUsuarioModificacion: { type: DataTypes.STRING(200), allowNull: true },
    fechaModificacion: { type: DataTypes.STRING(100), allowNull: true }
  }, {
    tableName: 'PTLWidgetsMaestro',
    timestamps: false
  });
};

module.exports = {
  WidgetMaestroModel,
  WidgetMaestroDTO,
  WidgetMaestroSchema
};