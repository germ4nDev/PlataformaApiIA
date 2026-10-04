/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization, Joi Validation
    Updated for: Metadata-Driven Layout Engine (Dynamic Zones)
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

// 1. ESQUEMA DE VALIDACIÓN (JOI)
const CfgZonasDinamicaSchema = Joi.object({
  codigoZona: Joi.string().max(200).required(),
  codigoPestana: Joi.string().max(200).required(),
  codigoMolde: Joi.string().max(100).required(),
  inicioX: Joi.number().integer().min(0).required(),
  inicioY: Joi.number().integer().min(0).required(),
  colsPorItem: Joi.number().integer().min(1).required(),
  rowsPorItem: Joi.number().integer().min(1).required(),
  estado: Joi.boolean().default(true),

  // Campos de auditoría
  codigoUsuario: Joi.string().max(200).required(),
  codigoUsuarioCreacion: Joi.string().max(200).allow('', null).optional(),
  fechaCreacion: Joi.string().max(100).allow('', null).optional(),
  codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
  fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

// 2. DATA TRANSFER OBJECT (DTO)
const CfgZonasDinamicaDTO = (rawData) => {
  const { error, value } = CfgZonDinamicaSchema.validate(rawData, { abortEarly: false, stripUnknown: true });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const fechaActual = new Date().toISOString();

  return {
    codigoZona: value.codigoZona.trim(),
    codigoPestana: value.codigoPestana.trim(),
    codigoMolde: value.codigoMolde.trim(),
    inicioX: value.inicioX,
    inicioY: value.inicioY,
    colsPorItem: value.colsPorItem,
    rowsPorItem: value.rowsPorItem,
    estado: value.estado,
    codigoUsuarioCreacion: value.codigoUsuarioCreacion || value.codigoUsuario.trim(),
    fechaCreacion: value.fechaCreacion || fechaActual,
    codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuario.trim(),
    fechaModificacion: value.fechaModificacion || fechaActual
  };
};

// 3. MODELO SEQUELIZE
const CfgZonasDinamicaModel = (sequelize) => {
  return sequelize.define('PTLCfgZonasDinamicas', {
    zonaId: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      allowNull: false
    },
    codigoZona: {
      type: DataTypes.STRING(200),
      primaryKey: true,
      allowNull: false
    },
    codigoPestana: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    codigoMolde: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    inicioX: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    inicioY: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    colsPorItem: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    rowsPorItem: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    estado: {
      type: DataTypes.BOOLEAN,
      allowNull: false
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
    tableName: 'PTLCfgZonasDinamicas',
    timestamps: false
  });
};

module.exports = {
  CfgZonasDinamicaModel,
  CfgZonasDinamicaDTO,
  CfgZonasDinamicaSchema
};