/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization, Joi Validation
    Entity: Movimientos de Contenedores (TLC_CONTENEDORES_001)
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const MovimientoContenedorSchema = Joi.object({
  id_puerto: Joi.string().max(50).required(),
  contenedor: Joi.string().max(30).required(),
  tipo: Joi.string().max(30).default("40' HC"),
  naviera: Joi.string().max(80).required(),
  operacion: Joi.string().max(60).required(),
  ruta: Joi.string().max(120).required(),
  cliente: Joi.string().max(120).required(),
  free_time: Joi.string().max(40).default('5d'),
  estado: Joi.string().max(40).default('Programado'),
  activo: Joi.boolean().required().default(true),

  // Auditoría Estándar QPLUS
  codigoUsuarioCreacion: Joi.string().max(200).allow('', null).optional(),
  fechaCreacion: Joi.string().max(100).allow('', null).optional(),
  codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
  fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const MovimientoContenedorDTO = (rawData, userContext = { codigoUsuario: 'SISTEMA_ADMIN' }) => {
  const { error, value } = MovimientoContenedorSchema.validate(rawData, {
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
    contenedor: value.contenedor.trim().toUpperCase(),
    tipo: value.tipo.trim(),
    naviera: value.naviera.trim(),
    operacion: value.operacion.trim(),
    ruta: value.ruta.replace(/\s*\?\s*/g, ' → ').trim(),
    cliente: value.cliente.trim(),
    free_time: value.free_time.trim(),
    estado: value.estado.trim(),
    activo: value.activo,

    // Auditoría QPLUS
    codigoUsuarioCreacion: usuarioBase,
    fechaCreacion: value.fechaCreacion || fechaActual,
    codigoUsuarioModificacion: value.codigoUsuarioModificacion || usuarioBase,
    fechaModificacion: value.fechaModificacion || fechaActual
  };
};

const MovimientoContenedorModel = (sequelize) => {
  return sequelize.define(
    'TCL_MovimientosContenedor',
    {
      id_movimiento: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: 'id_movimiento'
      },
      id_puerto: { type: DataTypes.STRING(50), allowNull: false },
      contenedor: { type: DataTypes.STRING(30), allowNull: false },
      tipo: { type: DataTypes.STRING(30), allowNull: false },
      naviera: { type: DataTypes.STRING(80), allowNull: false },
      operacion: { type: DataTypes.STRING(60), allowNull: false },
      ruta: { type: DataTypes.STRING(120), allowNull: false },
      cliente: { type: DataTypes.STRING(120), allowNull: false },
      free_time: { type: DataTypes.STRING(40), allowNull: false },
      estado: { type: DataTypes.STRING(40), allowNull: false },
      activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },

      // Auditoría QPLUS
      codigoUsuarioCreacion: { type: DataTypes.STRING(200), allowNull: true },
      fechaCreacion: { type: DataTypes.STRING(100), allowNull: true },
      codigoUsuarioModificacion: { type: DataTypes.STRING(200), allowNull: true },
      fechaModificacion: { type: DataTypes.STRING(100), allowNull: true }
    },
    {
      tableName: 'TCL_MovimientosContenedor',
      schema: 'dbo',
      timestamps: false
    }
  );
};

module.exports = {
  MovimientoContenedorModel,
  MovimientoContenedorDTO,
  MovimientoContenedorSchema
};