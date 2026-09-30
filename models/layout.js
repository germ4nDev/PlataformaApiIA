/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization, Joi Validation & SQL Server precision
    Updated for: Normalized Gridster Layout Structure (One row per widget)
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

// 1. ESQUEMA DE VALIDACIÓN (JOI)
const LayoutSchema = Joi.object({
  codigoLayout: Joi.string().max(200).required(),
  codigoUsuario: Joi.string().max(200).required(),
  codigoPestana: Joi.string().max(100).required(),
  codigoWidget: Joi.string().max(200).required(),
  posicion_x: Joi.number().integer().min(0).required(),
  posicion_y: Joi.number().integer().min(0).required(),
  cols: Joi.number().integer().min(1).required(),
  rows: Joi.number().integer().min(1).required(),

  // config permite nulos según la base de datos y puede llegar como objeto o string
  config: Joi.alternatives().try(Joi.string(), Joi.object()).allow('', null).optional(),

  codigoUsuarioCreacion: Joi.string().max(200).allow('', null).optional(),
  fechaCreacion: Joi.string().max(100).allow('', null).optional(),
  codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
  fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

// 2. DATA TRANSFER OBJECT (DTO)
const LayoutDTO = (rawData) => {
  const { error, value } = LayoutSchema.validate(rawData, { abortEarly: false, stripUnknown: true });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const fechaActual = new Date().toISOString();

  // Aseguramos que la configuración individual del widget se guarde como un JSON string limpio
  const configStringified = (value.config && typeof value.config !== 'string')
    ? JSON.stringify(value.config)
    : (value.config || null);

  return {
    codigoLayout: value.codigoLayout.trim(),
    codigoUsuario: value.codigoUsuario.trim(),
    codigoPestana: value.codigoPestana.trim(),
    codigoWidget: value.codigoWidget.trim(),
    posicion_x: value.posicion_x,
    posicion_y: value.posicion_y,
    cols: value.cols,
    rows: value.rows,
    config: configStringified,
    codigoUsuarioCreacion: value.codigoUsuarioCreacion || value.codigoUsuario.trim(),
    fechaCreacion: value.fechaCreacion || fechaActual,
    codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuario.trim(),
    fechaModificacion: value.fechaModificacion || fechaActual
  };
};

// 3. MODELO SEQUELIZE
const LayoutModel = (sequelize) => {
  return sequelize.define('PTLLayouts', {
    // layoutId es un int, probablemente un identity auto-incremental, pero NO es la llave primaria según la imagen
    layoutId: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      allowNull: false
    },
    // codigoLayout tiene el ícono de llave (PK)
    codigoLayout: {
      type: DataTypes.STRING(200),
      primaryKey: true,
      allowNull: false
    },
    codigoUsuario: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    codigoPestana: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    codigoWidget: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    posicion_x: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    posicion_y: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    cols: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    rows: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    // nvarchar(MAX) en SQL Server se mapea mejor como TEXT en Sequelize
    config: {
      type: DataTypes.TEXT,
      allowNull: true
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
    tableName: 'PTLLayouts',
    timestamps: false
  });
};

module.exports = {
  LayoutModel,
  LayoutDTO,
  LayoutSchema
};