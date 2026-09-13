/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization, Joi Validation & SQL Server precision
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const LayoutSchema = Joi.object({
  codigoUsuario: Joi.string().max(200).required(),
  // El layout puede venir como objeto/array de gridster o ya serializado en string
  layoutData: Joi.alternatives().try(Joi.string(), Joi.array(), Joi.object()).required(),

  codigoUsuarioCreacion: Joi.string().max(200).allow('', null).optional(),
  fechaCreacion: Joi.string().max(100).allow('', null).optional(),
  codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
  fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const LayoutDTO = (rawData) => {
  const { error, value } = LayoutSchema.validate(rawData, { abortEarly: false, stripUnknown: true });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const fechaActual = new Date().toISOString();

  // Aseguramos que el layout se guarde como un JSON string limpio en la base de datos
  const layoutStringified = typeof value.layoutData === 'string'
    ? value.layoutData
    : JSON.stringify(value.layoutData);

  return {
    codigoUsuario: value.codigoUsuario.trim(),
    layoutData: layoutStringified,
    codigoUsuarioCreacion: value.codigoUsuarioCreacion || value.codigoUsuario.trim(),
    fechaCreacion: value.fechaCreacion || fechaActual,
    codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuario.trim(),
    fechaModificacion: value.fechaModificacion || fechaActual
  };
};

const LayoutModel = (sequelize) => {
  return sequelize.define('PTLLayouts', {
    layoutId: { type: DataTypes.INTEGER, autoIncrement: true },
    codigoUsuario: { type: DataTypes.STRING(200), primaryKey: true, allowNull: false },
    layoutData: { type: DataTypes.TEXT, allowNull: false }, // NVARCHAR(MAX) en SQL Server
    codigoUsuarioCreacion: { type: DataTypes.STRING(200), allowNull: true },
    fechaCreacion: { type: DataTypes.STRING(100), allowNull: true },
    codigoUsuarioModificacion: { type: DataTypes.STRING(200), allowNull: true },
    fechaModificacion: { type: DataTypes.STRING(100), allowNull: true }
  }, {
    tableName: 'PTLLayouts',
    timestamps: false
  });
};

module.exports = {
  LayoutModel,
  LayoutDTO,
  LayoutSchema
};