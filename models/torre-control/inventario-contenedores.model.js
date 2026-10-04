/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization, Joi Validation & SQL Server precision
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

// ==========================================
// 1. JOI SCHEMA (Validación Estricta)
// ==========================================
const InventarioContenedoresSchema = Joi.object({
  id_inventario: Joi.string().guid({ version: ['uuidv4'] }).required(),
  id_puerto: Joi.string().max(50).required(),

  sigla_numero: Joi.string().max(20).required(),
  codigo_iso: Joi.string().max(10).required(),
  naviera: Joi.string().max(100).required(),

  estado_carga: Joi.string().max(20).required(),
  peso_tara_kg: Joi.number().precision(2).allow(null).optional(),
  peso_bruto_kg: Joi.number().precision(2).allow(null).optional(),

  ubicacion_bloque: Joi.string().max(10).allow('', null).optional(),
  ubicacion_bahia: Joi.string().max(10).allow('', null).optional(),
  ubicacion_fila: Joi.string().max(10).allow('', null).optional(),
  ubicacion_altura: Joi.number().integer().allow(null).optional(),

  es_reefer: Joi.boolean().optional().default(false),
  temp_requerida_celsius: Joi.number().precision(2).allow(null).optional(),
  codigo_imo: Joi.string().max(20).allow('', null).optional(),

  fecha_ingreso: Joi.string().max(100).required(),
  fecha_limite_freetime: Joi.string().max(100).allow('', null).optional(),
  estado_operativo: Joi.string().max(50).optional().default('EN_PATIO'),

  codigoUsuarioCreacion: Joi.string().max(200).required(),
  fechaCreacion: Joi.string().max(100).required(),
  codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
  fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

// ==========================================
// 2. DATA TRANSFER OBJECT (Sanitización)
// ==========================================
const InventarioContenedoresDTO = (rawData) => {
  const { error, value } = InventarioContenedoresSchema.validate(rawData, { abortEarly: false, stripUnknown: true });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const fechaActual = new Date().toISOString();

  return {
    id_inventario: value.id_inventario,
    id_puerto: value.id_puerto.trim().toUpperCase(),

    // Estandarización de nomenclaturas portuarias
    sigla_numero: value.sigla_numero.trim().toUpperCase(),
    codigo_iso: value.codigo_iso.trim().toUpperCase(),
    naviera: value.naviera.trim().toUpperCase(),

    estado_carga: value.estado_carga.trim().toUpperCase(),
    peso_tara_kg: value.peso_tara_kg || 0,
    peso_bruto_kg: value.peso_bruto_kg || 0,

    ubicacion_bloque: value.ubicacion_bloque ? value.ubicacion_bloque.trim().toUpperCase() : null,
    ubicacion_bahia: value.ubicacion_bahia ? value.ubicacion_bahia.trim().toUpperCase() : null,
    ubicacion_fila: value.ubicacion_fila ? value.ubicacion_fila.trim().toUpperCase() : null,
    ubicacion_altura: value.ubicacion_altura || null,

    es_reefer: value.es_reefer,
    temp_requerida_celsius: value.temp_requerida_celsius || null,
    codigo_imo: value.codigo_imo ? value.codigo_imo.trim().toUpperCase() : null,

    fecha_ingreso: value.fecha_ingreso,
    fecha_limite_freetime: value.fecha_limite_freetime || null,
    estado_operativo: value.estado_operativo.trim().toUpperCase(),

    codigoUsuarioCreacion: value.codigoUsuarioCreacion,
    fechaCreacion: value.fechaCreacion || fechaActual,
    codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
    fechaModificacion: value.fechaModificacion || fechaActual
  };
};

// ==========================================
// 3. SEQUELIZE MODEL (Definición de BD)
// ==========================================
const InventarioContenedoresModel = (sequelize) => {
  return sequelize.define('T_Inventario_Contenedores', {
    id_inventario: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    id_puerto: { type: DataTypes.STRING(50), allowNull: false },

    sigla_numero: { type: DataTypes.STRING(20), allowNull: false },
    codigo_iso: { type: DataTypes.STRING(10), allowNull: false },
    naviera: { type: DataTypes.STRING(100), allowNull: false },

    estado_carga: { type: DataTypes.STRING(20), allowNull: false },
    peso_tara_kg: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    peso_bruto_kg: { type: DataTypes.DECIMAL(10, 2), allowNull: true },

    ubicacion_bloque: { type: DataTypes.STRING(10), allowNull: true },
    ubicacion_bahia: { type: DataTypes.STRING(10), allowNull: true },
    ubicacion_fila: { type: DataTypes.STRING(10), allowNull: true },
    ubicacion_altura: { type: DataTypes.INTEGER, allowNull: true },

    es_reefer: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    temp_requerida_celsius: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
    codigo_imo: { type: DataTypes.STRING(20), allowNull: true },

    // Tratados como STRING(100) para manejar ISOString consistente en toda la app
    fecha_ingreso: { type: DataTypes.STRING(100), allowNull: false },
    fecha_limite_freetime: { type: DataTypes.STRING(100), allowNull: true },

    estado_operativo: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'EN_PATIO' },

    // Auditoría
    codigoUsuarioCreacion: { type: DataTypes.STRING(200), allowNull: true },
    fechaCreacion: { type: DataTypes.STRING(100), allowNull: true },
    codigoUsuarioModificacion: { type: DataTypes.STRING(200), allowNull: true },
    fechaModificacion: { type: DataTypes.STRING(100), allowNull: true }
  }, {
    tableName: 'T_Inventario_Contenedores',
    timestamps: false
  });
};

module.exports = {
  InventarioContenedoresModel,
  InventarioContenedoresDTO,
  InventarioContenedoresSchema
};