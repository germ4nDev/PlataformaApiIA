/*
    Author: German Valencia
    Pattern: PORTTOS DTO Pattern - Movimiento Terrestre (Refactorizado a Espacial)
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

// 1. ESQUEMA DE VALIDACIÓN (Joi)
const MovimientoTerrestreSchema = Joi.object({
  codigoMovimiento: Joi.string().max(36).optional(),
  codigoUnidad: Joi.string().max(36).required(),
  placaCamion: Joi.string().min(5).max(10).required(),
  empresaTransporte: Joi.string().max(150).optional().allow(null, ''),
  cedulaConductor: Joi.string().max(50).optional().allow(null, ''),
  estadoMovimiento: Joi.string().valid('PROGRAMADO', 'EN_RUTA', 'EN_PUERTA', 'CARGANDO', 'SALIDA').required(),

  fechaCitaGate: Joi.date().iso().optional().allow(null),
  fechaGateIn: Joi.date().iso().optional().allow(null),
  fechaGateOut: Joi.date().iso().optional().allow(null),

  // NUEVO: Capa Geoespacial Consistente
  ubicacion_geo: Joi.object({
    type: Joi.string().valid('Point').required(),
    coordinates: Joi.array().items(Joi.number()).length(2).required() // [lon, lat]
  }).optional().allow(null),

  velocidadKmH: Joi.number().min(0).optional().allow(null),
  estadoMotor: Joi.boolean().optional().allow(null),
  fechaUltimaPosicion: Joi.date().iso().optional().allow(null),
  fechaCreacion: Joi.string().optional()
});

// 2. DATA TRANSFER OBJECT (DTO)
const MovimientoTerrestreDTO = (rawData, userContext = { codigoUsuario: 'SISTEMA_ADMIN' }) => {
  const { error, value } = MovimientoTerrestreSchema.validate(rawData, { abortEarly: false, stripUnknown: true });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const fechaActual = new Date().toISOString();
  const usuarioIngesta = userContext.codigoUsuario;

  return {
    codigoMovimiento: value.codigoMovimiento || uuidv4(),
    codigoUnidad: value.codigoUnidad,
    placaCamion: value.placaCamion.trim().toUpperCase(),
    empresaTransporte: value.empresaTransporte ? value.empresaTransporte.trim().toUpperCase() : null,
    cedulaConductor: value.cedulaConductor ? value.cedulaConductor.trim() : null,
    estadoMovimiento: value.estadoMovimiento,

    fechaCitaGate: value.fechaCitaGate || null,
    fechaGateIn: value.fechaGateIn || null,
    fechaGateOut: value.fechaGateOut || null,

    // El objeto se envía tal cual, el Repositorio se encargará del WKT o WKB
    ubicacion_geo: value.ubicacion_geo ? {
      type: 'Point',
      coordinates: value.ubicacion_geo.coordinates
    } : null,

    velocidadKmH: value.velocidadKmH || null,
    estadoMotor: value.estadoMotor !== undefined ? value.estadoMotor : null,
    fechaUltimaPosicion: value.fechaUltimaPosicion || null,

    codigoUsuarioCreacion: usuarioIngesta,
    fechaCreacion: value.fechaCreacion || fechaActual
  };
};

// 3. MODELO ORM (Sequelize)
const MovimientoTerrestreModel = (sequelize) => {
  return sequelize.define('TLC_Movimiento_Terrestre', {
    codigoMovimiento: { type: DataTypes.STRING(36), primaryKey: true, allowNull: false },
    codigoUnidad: { type: DataTypes.STRING(36), allowNull: false },
    placaCamion: { type: DataTypes.STRING(10), allowNull: false },
    empresaTransporte: { type: DataTypes.STRING(150), allowNull: true },
    cedulaConductor: { type: DataTypes.STRING(50), allowNull: true },
    estadoMovimiento: { type: DataTypes.STRING(50), allowNull: false },

    fechaCitaGate: { type: DataTypes.DATE, allowNull: true },
    fechaGateIn: { type: DataTypes.DATE, allowNull: true },
    fechaGateOut: { type: DataTypes.DATE, allowNull: true },

    // AQUÍ ESTÁ EL CAMBIO DE HOMOGENEIDAD
    ubicacion_geo: {
      type: DataTypes.GEOMETRY('POINT'),
      allowNull: true
    },

    velocidadKmH: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
    estadoMotor: { type: DataTypes.BOOLEAN, allowNull: true },
    fechaUltimaPosicion: { type: DataTypes.DATE, allowNull: true },

    codigoUsuarioCreacion: { type: DataTypes.STRING(200), allowNull: false },
    fechaCreacion: { type: DataTypes.STRING(100), allowNull: false }
  }, {
    tableName: 'TLC_Movimiento_Terrestre',
    schema: 'dbo',
    timestamps: false
  });
};

module.exports = { MovimientoTerrestreModel, MovimientoTerrestreDTO, MovimientoTerrestreSchema };