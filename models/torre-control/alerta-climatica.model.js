/*
    Author: German Valencia
    Pattern: PORTTOS DTO Pattern - Alertas Meteorológicas (IDEAM / Clima)
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

// 1. EL ESCUDO: Validación Joi
const AlertaClimaticaSchema = Joi.object({
  region: Joi.string().valid(
    'PACIFICO', 'CARIBE', 'ANDINA', 'ORINOQUIA', 'AMAZONIA', 'INSULAR'
  ).required(),

  // El corredor ya no es un Enum cerrado, sino un string libre (validado en DB)
  corredorVial: Joi.string().min(3).max(150).required(),

  sector: Joi.string().max(100).required(),

  tipoAlerta: Joi.string().valid(
    'LLUVIA_FUERTE',
    'TORMENTA_ELECTRICA',
    'NIEBLA_BAJA_VISIBILIDAD',
    'VIENTOS_FUERTES',
    'ALERTA_DESLIZAMIENTO'
  ).required(),

  sector: Joi.string().max(100).required(), // Ej: 'Lobo Guerrero', 'Km 40', 'Bahía Interna'

  tipoAlerta: Joi.string().valid(
    'LLUVIA_FUERTE',
    'TORMENTA_ELECTRICA',
    'NIEBLA_BAJA_VISIBILIDAD',
    'VIENTOS_FUERTES',
    'ALERTA_DESLIZAMIENTO'
  ).required(),

  descripcion: Joi.string().max(1000).allow(null, '').optional(),

  // Datos métricos para robustecer el análisis de la Torre de Control
  intensidadPrecipitacion: Joi.number().min(0).allow(null).optional(), // mm/h
  velocidadViento: Joi.number().min(0).allow(null).optional(), // km/h
  visibilidadEstimada: Joi.number().min(0).allow(null).optional(), // metros

  // 1: Informativa / Riesgo Bajo, 2: Riesgo Moderado (Operación con precaución), 3: Alerta Máxima (Parálisis/Suspensión)
  nivelSeveridad: Joi.number().integer().valid(1, 2, 3).required(),

  estadoAlerta: Joi.string().valid('ACTIVO', 'DISIPADO').default('ACTIVO'),

  fechaInicio: Joi.date().iso().required(),
  fechaFin: Joi.date().iso().min(Joi.ref('fechaInicio')).allow(null).optional()
});

// 2. EL ENSAMBLADOR: DTO
const AlertaClimaticaDTO = (rawData, userContext) => {
  const { error, value } = AlertaClimaticaSchema.validate(rawData, { abortEarly: false, stripUnknown: true });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  return {
    codigoAlerta: uuidv4(), // Plataforma 2.0 UUID

    corredorVial: value.corredorVial,
    sector: value.sector.trim().toUpperCase(),
    tipoAlerta: value.tipoAlerta,
    descripcion: value.descripcion ? value.descripcion.trim() : null,
    intensidadPrecipitacion: value.intensidadPrecipitacion ?? null,
    velocidadViento: value.velocidadViento ?? null,
    visibilidadEstimada: value.visibilidadEstimada ?? null,
    nivelSeveridad: value.nivelSeveridad,
    estadoAlerta: value.estadoAlerta,
    fechaInicio: value.fechaInicio,
    fechaFin: value.fechaFin || null,

    // Auditoría PORTTOS
    codigoUsuarioCreacion: userContext.codigoUsuario,
    fechaCreacion: new Date(),
    codigoUsuarioModificacion: userContext.codigoUsuario,
    fechaModificacion: new Date()
  };
};

// 3. EL MAPEO: Modelo Sequelize
const AlertaClimaticaModel = (sequelize) => {
  return sequelize.define('TCLAlertasClimaticas', {
    codigoAlerta: {
      type: DataTypes.STRING(36),
      primaryKey: true,
      allowNull: false
    },
    region: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    corredorVial: {
      type: DataTypes.STRING(150),
      allowNull: false
    },
    sector: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    tipoAlerta: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    intensidadPrecipitacion: {
      type: DataTypes.DECIMAL(10, 2), // Permite guardar con precisión decimal ej: 45.50 mm/h
      allowNull: true
    },
    velocidadViento: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    visibilidadEstimada: {
      type: DataTypes.INTEGER, // Guardado en metros
      allowNull: true
    },
    nivelSeveridad: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    estadoAlerta: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'ACTIVO'
    },
    fechaInicio: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    fechaFin: {
      type: DataTypes.STRING(100),
      allowNull: true
    },

    // Auditoría PORTTOS
    codigoUsuarioCreacion: { type: DataTypes.STRING(200), allowNull: false },
    fechaCreacion: { type: DataTypes.STRING(100), allowNull: false },
    codigoUsuarioModificacion: { type: DataTypes.STRING(200), allowNull: true },
    fechaModificacion: { type: DataTypes.STRING(100), allowNull: true },
  }, {
    tableName: 'TCLAlertasClimaticas',
    timestamps: false
  });
};

module.exports = {
  AlertaClimaticaModel,
  AlertaClimaticaDTO,
  AlertaClimaticaSchema
};