/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization, Joi Validation
    Entity: Maestro de Bodegas y Silos (TLC_BODEGAS_001)
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

// 1. EL ESCUDO: Validación Joi con esquema de auditoría QPLUS
const MaestroBodegaSchema = Joi.object({
  id_puerto: Joi.string().max(50).required(),
  codigo_bodega: Joi.string().max(30).required(),
  nombre_bodega: Joi.string().max(120).required(),
  tipo_almacenamiento: Joi.string()
    .valid('CUBIERTA', 'SILO', 'REFRIGERADA', 'COBERTIZO')
    .default('CUBIERTA'),
  tipo_carga_principal: Joi.string().max(60).default('Carga General'),
  capacidad_maxima_ton: Joi.number().positive().required(),
  inventario_actual_ton: Joi.number().min(0).default(0),
  temperatura_c: Joi.number().min(-50).max(60).allow(null).optional(),
  humedad_relativa_pct: Joi.number().min(0).max(100).allow(null).optional(),
  estado_operativo: Joi.string()
    .valid('NORMAL', 'ALTO', 'CRÍTICO', 'MANTENIMIENTO')
    .optional(),
  activo: Joi.boolean().required().default(true),

  // Auditoría Estándar QPLUS
  codigoUsuarioCreacion: Joi.string().max(200).allow('', null).optional(),
  fechaCreacion: Joi.string().max(100).allow('', null).optional(),
  codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
  fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

// 2. EL ENSAMBLADOR: DTO para sanear, calcular semáforo y aplicar auditoría QPLUS
const MaestroBodegaDTO = (rawData, userContext = { codigoUsuario: 'SISTEMA_ADMIN' }) => {
  const { error, value } = MaestroBodegaSchema.validate(rawData, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map((d) => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const ocupacionPct =
    value.capacidad_maxima_ton > 0
      ? (value.inventario_actual_ton / value.capacidad_maxima_ton) * 100
      : 0;

  let estadoCalculado = value.estado_operativo;
  if (!estadoCalculado) {
    if (ocupacionPct >= 90) estadoCalculado = 'CRÍTICO';
    else if (ocupacionPct >= 75) estadoCalculado = 'ALTO';
    else estadoCalculado = 'NORMAL';
  }

  const fechaActual = new Date().toISOString();
  const usuarioBase = value.codigoUsuarioCreacion || userContext.codigoUsuario || 'SISTEMA_ADMIN';

  return {
    id_puerto: value.id_puerto.trim().toUpperCase(),
    codigo_bodega: value.codigo_bodega.trim().toUpperCase(),
    nombre_bodega: value.nombre_bodega.trim(),
    tipo_almacenamiento: value.tipo_almacenamiento.trim().toUpperCase(),
    tipo_carga_principal: value.tipo_carga_principal.trim(),
    capacidad_maxima_ton: Number(value.capacidad_maxima_ton),
    inventario_actual_ton: Number(value.inventario_actual_ton),
    temperatura_c: value.temperatura_c !== undefined ? value.temperatura_c : null,
    humedad_relativa_pct:
      value.humedad_relativa_pct !== undefined ? value.humedad_relativa_pct : null,
    estado_operativo: estadoCalculado.toUpperCase(),
    activo: value.activo,

    // Auditoría QPLUS
    codigoUsuarioCreacion: usuarioBase,
    fechaCreacion: value.fechaCreacion || fechaActual,
    codigoUsuarioModificacion: value.codigoUsuarioModificacion || usuarioBase,
    fechaModificacion: value.fechaModificacion || fechaActual
  };
};

// 3. EL MAPEO: Definición de Sequelize
const MaestroBodegaModel = (sequelize) => {
  return sequelize.define(
    'TCL_MaestroBodegas',
    {
      id_bodega: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: 'id_bodega'
      },
      id_puerto: { type: DataTypes.STRING(50), allowNull: false },
      codigo_bodega: { type: DataTypes.STRING(30), allowNull: false },
      nombre_bodega: { type: DataTypes.STRING(120), allowNull: false },
      tipo_almacenamiento: { type: DataTypes.STRING(50), allowNull: false },
      tipo_carga_principal: { type: DataTypes.STRING(60), allowNull: false },
      capacidad_maxima_ton: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      inventario_actual_ton: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0
      },
      temperatura_c: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      humedad_relativa_pct: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      estado_operativo: {
        type: DataTypes.STRING(30),
        allowNull: false,
        defaultValue: 'NORMAL'
      },
      activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },

      // Auditoría QPLUS
      codigoUsuarioCreacion: { type: DataTypes.STRING(200), allowNull: true },
      fechaCreacion: { type: DataTypes.STRING(100), allowNull: true },
      codigoUsuarioModificacion: { type: DataTypes.STRING(200), allowNull: true },
      fechaModificacion: { type: DataTypes.STRING(100), allowNull: true }
    },
    {
      tableName: 'TCL_MaestroBodegas',
      schema: 'dbo',
      timestamps: false
    }
  );
};

module.exports = {
  MaestroBodegaModel,
  MaestroBodegaDTO,
  MaestroBodegaSchema
};