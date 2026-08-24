/*
    Author: German Valencia
    Pattern: QPLUS DTO Pattern - Motonaves Operación
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

// 1. EL ESCUDO: Validación estricta de la data de operación
const MotonavesOperacionSchema = Joi.object({
  codigoNodo: Joi.string().max(36).required(),
  nombreNodo: Joi.string().max(150).required(),
  tipoNodo: Joi.string().max(50).required(),
  capacidadMaxima: Joi.number().precision(2).required(),
  ocupacionActual: Joi.number().precision(2).required(),
  unidadMedida: Joi.string().max(20).required(),
  latitud: Joi.number().allow(null).optional(),
  longitud: Joi.number().allow(null).optional(),
  estadoOperativo: Joi.string().max(20).required() // Ej: 'OPERATIVO', 'MANTENIMIENTO'
});

// 2. EL ENSAMBLADOR: Construcción del DTO seguro y aplicación de auditoría
const MotonavesOperacionDTO = (rawData, userContext) => {
  const { error, value } = MotonavesOperacionSchema.validate(rawData, { abortEarly: false, stripUnknown: true });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  return {
    codigoNodo: value.codigoNodo.trim(),
    nombreNodo: value.nombreNodo.trim(),
    tipoNodo: value.tipoNodo.trim().toUpperCase(),
    capacidadMaxima: value.capacidadMaxima,
    ocupacionActual: value.ocupacionActual,
    unidadMedida: value.unidadMedida.trim().toUpperCase(),
    latitud: value.latitud || null,
    longitud: value.longitud || null,
    estadoOperativo: value.estadoOperativo.trim().toUpperCase(),

    // Auditoría QPLUS
    codigoUsuarioCreacion: userContext.codigoUsuario,
    fechaCreacion: new Date(),
    codigoUsuarioModificacion: userContext.codigoUsuario,
    fechaModificacion: new Date()
  };
};

// 3. EL MAPEO: Definición de Sequelize para TCLMotonavesOperacion
const MotonavesOperacionModel = (sequelize) => {
  return sequelize.define('TCLMotonavesOperacion', {
    codigoNodo: {
      type: DataTypes.STRING(36),
      primaryKey: true,
      allowNull: false,
      field: 'codigoNodo'
    },
    nombreNodo: {
      type: DataTypes.STRING(150),
      allowNull: false,
      field: 'nombreNodo'
    },
    tipoNodo: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'tipoNodo'
    },
    capacidadMaxima: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      field: 'capacidadMaxima'
    },
    ocupacionActual: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      field: 'ocupacionActual'
    },
    unidadMedida: {
      type: DataTypes.STRING(20),
      allowNull: false,
      field: 'unidadMedida'
    },
    latitud: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true,
      field: 'latitud'
    },
    longitud: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true,
      field: 'longitud'
    },
    estadoOperativo: {
      type: DataTypes.STRING(20),
      allowNull: false,
      field: 'estadoOperativo'
    },
    codigoUsuarioCreacion: {
      type: DataTypes.STRING(200),
      allowNull: false,
      field: 'codigoUsuarioCreacion'
    },
    fechaCreacion: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'fechaCreacion'
    },
    codigoUsuarioModificacion: {
      type: DataTypes.STRING(200),
      allowNull: true,
      field: 'codigoUsuarioModificacion'
    },
    fechaModificacion: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'fechaModificacion'
    }
  }, {
    tableName: 'TCLMotonavesOperacion',
    schema: 'dbo',
    timestamps: false
  });
};

module.exports = {
  MotonavesOperacionModel,
  MotonavesOperacionDTO,
  MotonavesOperacionSchema
};