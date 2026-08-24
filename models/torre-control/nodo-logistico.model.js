/*
    Author: German Valencia
    Pattern: QPLUS DTO Pattern - Nodos Logísticos (Bodegas, Patios, Muelles y Buques)
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

// 1. EL ESCUDO: Validación Joi Expandida
const NodoLogisticoSchema = Joi.object({
  // Permitimos que envíen el código (Ej: Nombre del buque), si no viene, se asume que es nuevo
  codigoNodo: Joi.string().max(36).allow(null, '').optional(),

  nombreNodo: Joi.string().max(150).required(),

  // 🔥 EXPANDIDO: Ahora soporta infraestructura estática y activos móviles
  tipoNodo: Joi.string().valid(
    'BODEGA_GRANEL', 'BODEGA_GENERAL', 'DEPOT_VACIOS', 'PATIO_PDI',
    'BUQUE', 'MUELLE'
  ).required(),

  capacidadMaxima: Joi.number().min(0).precision(2).required(),
  ocupacionActual: Joi.number().min(0).precision(2).max(Joi.ref('capacidadMaxima')).default(0),

  // 🔥 EXPANDIDO: Soporte para vehículos
  unidadMedida: Joi.string().valid('TM', 'TEU', 'UNIDADES', 'VEHICULOS').required(),

  latitud: Joi.number().min(-90).max(90).allow(null).optional(),
  longitud: Joi.number().min(-180).max(180).allow(null).optional(),

  // 🔥 EXPANDIDO: Estados para buques y muelles
  estadoOperativo: Joi.string().valid(
    'ACTIVO', 'SUSPENDIDO',
    'OPERANDO', 'FONDEO', 'EN TRÁNSITO', 'DISPONIBLE'
  ).default('ACTIVO')
});

// 2. EL ENSAMBLADOR: DTO
const NodoLogisticoDTO = (rawData, userContext) => {
  const { error, value } = NodoLogisticoSchema.validate(rawData, { abortEarly: false, stripUnknown: true });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  return {
    // 🔥 CORRECCIÓN UPSERT: Si viene un código (ej: el scraper mandó el nombre del buque), lo usamos. 
    // Si no (ej: creando una bodega manual), generamos el UUID.
    codigoNodo: value.codigoNodo ? value.codigoNodo.trim() : uuidv4(),

    nombreNodo: value.nombreNodo.trim().toUpperCase(),
    tipoNodo: value.tipoNodo,
    capacidadMaxima: value.capacidadMaxima,
    ocupacionActual: value.ocupacionActual,
    unidadMedida: value.unidadMedida,
    latitud: value.latitud,
    longitud: value.longitud,
    estadoOperativo: value.estadoOperativo,

    // Auditoría QPLUS
    codigoUsuarioCreacion: userContext.codigoUsuario,
    fechaCreacion: new Date(),
    codigoUsuarioModificacion: userContext.codigoUsuario,
    fechaModificacion: new Date()
  };
};

// 3. EL MAPEO: Modelo Sequelize (Se mantiene igual, estaba perfecto)
const NodoLogisticoModel = (sequelize) => {
  return sequelize.define('TCLNodosLogisticos', {
    codigoNodo: {
      type: DataTypes.STRING(36),
      primaryKey: true,
      allowNull: false
    },
    // ... (El resto de tu modelo queda exactamente igual) ...
    nombreNodo: { type: DataTypes.STRING(150), allowNull: false },
    tipoNodo: { type: DataTypes.STRING(50), allowNull: false },
    capacidadMaxima: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    ocupacionActual: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0.00 },
    unidadMedida: { type: DataTypes.STRING(20), allowNull: false },
    latitud: { type: DataTypes.DECIMAL(10, 8), allowNull: true },
    longitud: { type: DataTypes.DECIMAL(11, 8), allowNull: true },
    estadoOperativo: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'ACTIVO' },
    codigoUsuarioCreacion: { type: DataTypes.STRING(200), allowNull: false },
    fechaCreacion: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    codigoUsuarioModificacion: { type: DataTypes.STRING(200), allowNull: true },
    fechaModificacion: { type: DataTypes.DATE, allowNull: true }
  }, {
    tableName: 'TCLNodosLogisticos',
    timestamps: false
  });
};

module.exports = {
  NodoLogisticoModel,
  NodoLogisticoDTO,   // <-- Debe estar escrito exactamente así (respetando mayúsculas)
  NodoLogisticoSchema
};