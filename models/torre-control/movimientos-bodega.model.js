/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization, Joi Validation
    Entity: Movimientos y Lotes en Bodega (TLC_BODEGAS_001)
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

// 1. EL ESCUDO: Validación Joi con esquema de auditoría QPLUS
const MovimientoBodegaSchema = Joi.object({
  id_puerto: Joi.string().max(50).required(),
  id_bodega: Joi.number().integer().allow(null).optional(),
  nombre_bodega: Joi.string().max(120).required(),
  lote_bl: Joi.string().max(50).required(),
  producto: Joi.string().max(80).required(),
  tipo_operacion: Joi.string()
    .valid('INGRESO BUQUE', 'DESPACHO CAMIÓN', 'TRASLADO INTERNO')
    .default('INGRESO BUQUE'),
  toneladas: Joi.number().positive().required(),
  cliente: Joi.string().max(120).required(),
  dias_almacenaje: Joi.number().integer().min(0).default(1),
  estado: Joi.string().max(30).default('Almacenado'),
  activo: Joi.boolean().required().default(true),

  // Auditoría Estándar QPLUS
  codigoUsuarioCreacion: Joi.string().max(200).allow('', null).optional(),
  fechaCreacion: Joi.string().max(100).allow('', null).optional(),
  codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
  fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

// 2. EL ENSAMBLADOR: DTO para sanear y aplicar auditoría QPLUS
const MovimientoBodegaDTO = (rawData, userContext = { codigoUsuario: 'SISTEMA_ADMIN' }) => {
  const { error, value } = MovimientoBodegaSchema.validate(rawData, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map((d) => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const fechaActual = new Date().toISOString();
  const usuarioBase = value.codigoUsuarioCreacion || userContext.codigoUsuario || 'SISTEMA_ADMIN';

  return {
    id_puerto: value.id_puerto.trim().toUpperCase(),
    id_bodega: value.id_bodega || null,
    nombre_bodega: value.nombre_bodega.trim(),
    lote_bl: value.lote_bl.trim().toUpperCase(),
    producto: value.producto.trim(),
    tipo_operacion: value.tipo_operacion.trim().toUpperCase(),
    toneladas: Number(value.toneladas),
    cliente: value.cliente.trim(),
    dias_almacenaje: value.dias_almacenaje,
    estado: value.estado.trim(),
    activo: value.activo,

    // Auditoría QPLUS
    codigoUsuarioCreacion: usuarioBase,
    fechaCreacion: value.fechaCreacion || fechaActual,
    codigoUsuarioModificacion: value.codigoUsuarioModificacion || usuarioBase,
    fechaModificacion: value.fechaModificacion || fechaActual
  };
};

// 3. EL MAPEO: Definición de Sequelize
const MovimientoBodegaModel = (sequelize) => {
  return sequelize.define(
    'TCL_MovimientosBodega',
    {
      id_movimiento_bodega: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: 'id_movimiento_bodega'
      },
      id_puerto: { type: DataTypes.STRING(50), allowNull: false },
      id_bodega: { type: DataTypes.INTEGER, allowNull: true },
      nombre_bodega: { type: DataTypes.STRING(120), allowNull: false },
      lote_bl: { type: DataTypes.STRING(50), allowNull: false },
      producto: { type: DataTypes.STRING(80), allowNull: false },
      tipo_operacion: { type: DataTypes.STRING(30), allowNull: false },
      toneladas: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
      cliente: { type: DataTypes.STRING(120), allowNull: false },
      dias_almacenaje: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      estado: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'Almacenado' },
      activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },

      // Auditoría QPLUS
      codigoUsuarioCreacion: { type: DataTypes.STRING(200), allowNull: true },
      fechaCreacion: { type: DataTypes.STRING(100), allowNull: true },
      codigoUsuarioModificacion: { type: DataTypes.STRING(200), allowNull: true },
      fechaModificacion: { type: DataTypes.STRING(100), allowNull: true }
    },
    {
      tableName: 'TCL_MovimientosBodega',
      schema: 'dbo',
      timestamps: false
    }
  );
};

module.exports = {
  MovimientoBodegaModel,
  MovimientoBodegaDTO,
  MovimientoBodegaSchema
};