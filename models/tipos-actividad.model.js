/*
    Author: German Valencia
    Description: Schema, DTO and Model for PTLTiposActividad (Categorización de Permisos RBAC)
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

// ==========================================
// 1. ESQUEMA DE VALIDACIÓN (JOI)
// ==========================================
const TipoActividadSchema = Joi.object({
  codigoTipoActividad: Joi.string().max(100).required()
    .messages({ 'any.required': 'El código del tipo de actividad es obligatorio (Ej: NAV, CRUD, EXEC).' }),

  nombreTipoActividad: Joi.string().max(200).required()
    .messages({ 'any.required': 'El nombre del tipo de actividad es obligatorio.' }),

  descripcionTipoActividad: Joi.string().max(500).allow('', null).optional(),

  estadoTipoActividad: Joi.boolean().required(),

  // Campos de Auditoría QPLUS
  codigoUsuarioCreacion: Joi.string().max(200).allow('', null).optional(),
  fechaCreacion: Joi.string().max(100).allow('', null).optional(),
  codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
  fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

// ==========================================
// 2. DATA TRANSFER OBJECT (DTO)
// ==========================================
const TipoActividadDTO = (rawData) => {
  const { error, value } = TipoActividadSchema.validate(rawData, { abortEarly: false });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const fechaActual = new Date().toISOString();

  return {
    codigoTipoActividad: value.codigoTipoActividad.trim().toUpperCase(), // Normalizamos a mayúsculas
    nombreTipoActividad: value.nombreTipoActividad.trim(),
    descripcionTipoActividad: value.descripcionTipoActividad ? value.descripcionTipoActividad.trim() : null,
    estadoTipoActividad: value.estadoTipoActividad,

    codigoUsuarioCreacion: value.codigoUsuarioCreacion,
    fechaCreacion: value.fechaCreacion || fechaActual,
    codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
    fechaModificacion: value.fechaModificacion || fechaActual
  };
};

// ==========================================
// 3. MODELO SEQUELIZE
// ==========================================
const TipoActividadModel = (sequelize) => {
  return sequelize.define('PTLTiposActividad', {
    tipoActividadId: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      allowNull: false
    },
    codigoTipoActividad: {
      type: DataTypes.STRING(100),
      primaryKey: true,
      allowNull: false
    },
    nombreTipoActividad: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    descripcionTipoActividad: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    estadoTipoActividad: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
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
    tableName: 'PTLTiposActividad',
    timestamps: false
  });
};

module.exports = {
  TipoActividadModel,
  TipoActividadDTO,
  TipoActividadSchema
};