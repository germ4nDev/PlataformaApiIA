/*
    Author: German Valencia
    Pattern: PORTTOS DTO Pattern - Operación Marítima (Visibilidad Océano)
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

// 1. ESQUEMA DE VALIDACIÓN (Joi)
const OperacionMaritimaSchema = Joi.object({
  codigoOperacion: Joi.string().max(36).optional(), // Autogenerado en DTO si no viene
  numeroViaje: Joi.string().max(50).required(),
  motonave: Joi.string().max(100).required(),
  naviera: Joi.string().max(100).required(),
  codigoNodo_atraque: Joi.string().max(36).optional().allow(null, ''),
  estadoBuque: Joi.string().valid('ETA', 'FONDEADO', 'ATRACADO', 'OPERANDO', 'ZARPE').required(),

  // Tiempos logísticos
  fechaETA: Joi.date().iso().optional().allow(null),
  fechaATA: Joi.date().iso().optional().allow(null),
  fechaETD: Joi.date().iso().optional().allow(null),

  // Capa Geoespacial (Telemetría AIS)
  latitudActual: Joi.number().min(-90).max(90).optional().allow(null),
  longitudActual: Joi.number().min(-180).max(180).optional().allow(null),
  rumboGrados: Joi.number().integer().min(0).max(360).optional().allow(null),
  velocidadNudos: Joi.number().min(0).optional().allow(null),
  fechaUltimaPosicion: Joi.date().iso().optional().allow(null),

  // Auditoría
  fechaCreacion: Joi.string().optional()
});

// 2. DATA TRANSFER OBJECT (DTO)
const OperacionMaritimaDTO = (rawData, userContext = { codigoUsuario: 'SISTEMA_ADMIN' }) => {
  const { error, value } = OperacionMaritimaSchema.validate(rawData, { abortEarly: false, stripUnknown: true });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const fechaActual = new Date().toISOString();
  const usuarioIngesta = userContext.codigoUsuario;

  return {
    codigoOperacion: value.codigoOperacion || uuidv4(),
    numeroViaje: value.numeroViaje.trim().toUpperCase(),
    motonave: value.motonave.trim().toUpperCase(),
    naviera: value.naviera.trim().toUpperCase(),
    codigoNodo_atraque: value.codigoNodo_atraque || null,
    estadoBuque: value.estadoBuque,

    fechaETA: value.fechaETA || null,
    fechaATA: value.fechaATA || null,
    fechaETD: value.fechaETD || null,

    latitudActual: value.latitudActual || null,
    longitudActual: value.longitudActual || null,
    rumboGrados: value.rumboGrados || null,
    velocidadNudos: value.velocidadNudos || null,
    fechaUltimaPosicion: value.fechaUltimaPosicion || null,

    codigoUsuarioCreacion: usuarioIngesta,
    fechaCreacion: value.fechaCreacion || fechaActual
  };
};

// 3. MODELO ORM (Sequelize)
const OperacionMaritimaModel = (sequelize) => {
  return sequelize.define('TLC_Operacion_Maritima', {
    codigoOperacion: {
      type: DataTypes.STRING(36),
      primaryKey: true,
      allowNull: false
    },
    numeroViaje: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    motonave: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    naviera: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    codigoNodo_atraque: {
      type: DataTypes.STRING(36),
      allowNull: true
    },
    estadoBuque: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    fechaETA: {
      type: DataTypes.DATE,
      allowNull: true
    },
    fechaATA: {
      type: DataTypes.DATE,
      allowNull: true
    },
    fechaETD: {
      type: DataTypes.DATE,
      allowNull: true
    },
    latitudActual: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true
    },
    longitudActual: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true
    },
    rumboGrados: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    velocidadNudos: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true
    },
    fechaUltimaPosicion: {
      type: DataTypes.DATE,
      allowNull: true
    },
    codigoUsuarioCreacion: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    fechaCreacion: {
      type: DataTypes.STRING(100), // Mantenemos tu estándar para fechas de auditoría
      allowNull: false
    }
  }, {
    tableName: 'TLC_Operacion_Maritima',
    schema: 'dbo',
    timestamps: false
  });
};

module.exports = { OperacionMaritimaModel, OperacionMaritimaDTO, OperacionMaritimaSchema };