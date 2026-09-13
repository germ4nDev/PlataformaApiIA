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
  imagenWidget: Joi.string().max(100).allow('', null).optional().default('no-widget.png'),
  defaultCols: Joi.number().integer().min(1).max(12).optional().default(4),
  defaultRows: Joi.number().integer().min(1).optional().default(3),
  layoutVersion: Joi.number().integer().min(1).optional().default(3),
  pestana: Joi.string().max(100).allow('', null).optional().default('TAB_PLAT_PRINCIPAL'),
  estadoWidget: Joi.boolean().optional().default(true),

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
    descripcionWidget: value.descripcionWidget.trim(),
    imagenWidget: value.imagenWidget.trim(),
    defaultCols: value.defaultCols,
    defaultRows: value.defaultRows,
    layoutVersion: value.layoutVersion,
    pestana: value.pestana,
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
    imagenWidget: { type: DataTypes.STRING(100), allowNull: true, defaultValue: 'no-widget.png' },

    defaultCols: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 4 },
    defaultRows: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 3 },
    pestana: { type: DataTypes.STRING(100), allowNull: true, defaultValue: 'TAB_PLAT_PRINCIPAL' },
    layoutVersion: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
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