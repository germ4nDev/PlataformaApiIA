/*
    Author: German Valencia
    Pattern: PORTTOS DTO Pattern - Eventos Viales (Crisis y Bloqueos)
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const GeoJSONSchema = Joi.object({
  type: Joi.string().valid('Point', 'LineString', 'Polygon').required(),
  coordinates: Joi.array().required()
}).unknown(true);

// 1. EL ESCUDO: Validación Joi (Ajustada para coincidir con límites de BD)
const EventoVialSchema = Joi.object({
  idExterno: Joi.string().max(100).required(),
  corredorVial: Joi.string().max(100).required(),
  sector: Joi.string().max(100).required(),
  tipoEvento: Joi.string().max(50).required(),
  descripcion: Joi.string().allow(null, '').optional(),
  ubicacion_geo: GeoJSONSchema.allow(null),
  nivelSeveridad: Joi.number().integer().valid(1, 2, 3).required(),
  estadoEvento: Joi.string().valid('ACTIVO', 'DESPEJADO').default('ACTIVO'),
  fechaInicio: Joi.date().iso().required(),
  fechaFin: Joi.date().iso().min(Joi.ref('fechaInicio')).allow(null).optional()
});

// 2. EL ENSAMBLADOR: DTO (Con "Válvulas de seguridad" para evitar truncamiento)
const EventoVialDTO = (rawData, userContext) => {
  const { error, value } = EventoVialSchema.validate(rawData, { abortEarly: false, stripUnknown: true });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const extractGeometry = (geo) => {
    if (!geo || !geo.type || !geo.coordinates) return null;
    return geo;
  };

  return {
    codigoEvento: value.idExterno,
    corredorVial: value.corredorVial.trim().substring(0, 100),
    sector: value.sector.trim().toUpperCase().substring(0, 100),
    tipoEvento: value.tipoEvento.trim().substring(0, 50),
    descripcion: value.descripcion ? value.descripcion.trim() : null, // Se guarda en TEXT, no necesita corte
    nivelSeveridad: value.nivelSeveridad,
    estadoEvento: value.estadoEvento,
    ubicacion_geo: extractGeometry(value.ubicacion_geo),
    fechaInicio: value.fechaInicio,
    fechaFin: value.fechaFin || null,

    // Auditoría PORTTOS (Corte preventivo)
    codigoUsuarioCreacion: userContext.codigoUsuario.substring(0, 200),
    fechaCreacion: new Date(),
    codigoUsuarioModificacion: userContext.codigoUsuario.substring(0, 200),
    fechaModificacion: new Date()
  };
};

// 3. EL MAPEO: Modelo Sequelize
const EventoVialModel = (sequelize) => {
  return sequelize.define('TCLEventosViales', {
    codigoEvento: { type: DataTypes.STRING(200), primaryKey: true, allowNull: false },
    corredorVial: { type: DataTypes.STRING(100), allowNull: false },
    sector: { type: DataTypes.STRING(100), allowNull: false },
    tipoEvento: { type: DataTypes.STRING(50), allowNull: false },
    descripcion: { type: DataTypes.TEXT, allowNull: true },
    nivelSeveridad: { type: DataTypes.INTEGER, allowNull: false },
    estadoEvento: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'ACTIVO' },
    ubicacion_geo: { type: DataTypes.GEOMETRY('POINT', 4326), allowNull: true },
    fechaInicio: { type: DataTypes.DATE, allowNull: false },
    fechaFin: { type: DataTypes.DATE, allowNull: true },
    codigoUsuarioCreacion: { type: DataTypes.STRING(200), allowNull: false },
    fechaCreacion: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    codigoUsuarioModificacion: { type: DataTypes.STRING(200), allowNull: true },
    fechaModificacion: { type: DataTypes.DATE, allowNull: true }
  }, {
    tableName: 'TCLEventosViales',
    timestamps: false
  });
};

module.exports = { EventoVialModel, EventoVialDTO, EventoVialSchema };