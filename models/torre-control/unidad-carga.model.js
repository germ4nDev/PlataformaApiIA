/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization, Joi Validation
    Entity: Inventario de Unidades de Carga (TLC_CONTENEDORES_001)
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const UnidadCargaSchema = Joi.object({
  id_puerto: Joi.string().max(50).required(),
  codigoUnidad: Joi.string().max(30).required(),
  tipoContenedor: Joi.string().max(30).default("40' HC"),
  naviera: Joi.string().max(80).required(),
  condicionCarga: Joi.string().valid('CARGADO', 'VACIO').default('CARGADO'),
  esReefer: Joi.boolean().default(false),
  diasFreeTime: Joi.number().integer().min(-60).max(60).default(5),
  temperaturaSet: Joi.number().min(-40).max(30).allow(null).optional(),
  activo: Joi.boolean().required().default(true),

  // Auditoría Estándar QPLUS
  codigoUsuarioCreacion: Joi.string().max(200).allow('', null).optional(),
  fechaCreacion: Joi.string().max(100).allow('', null).optional(),
  codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
  fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const UnidadCargaDTO = (rawData, userContext = { codigoUsuario: 'SISTEMA_ADMIN' }) => {
  const { error, value } = UnidadCargaSchema.validate(rawData, {
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
    codigoUnidad: value.codigoUnidad.trim().toUpperCase(),
    tipoContenedor: value.tipoContenedor.trim(),
    naviera: value.naviera.trim(),
    condicionCarga: value.condicionCarga.trim().toUpperCase(),
    esReefer: Boolean(value.esReefer || value.tipoContenedor.toUpperCase().includes('RF')),
    diasFreeTime: value.diasFreeTime,
    temperaturaSet: value.temperaturaSet !== undefined ? value.temperaturaSet : null,
    activo: value.activo,

    // Auditoría QPLUS
    codigoUsuarioCreacion: usuarioBase,
    fechaCreacion: value.fechaCreacion || fechaActual,
    codigoUsuarioModificacion: value.codigoUsuarioModificacion || usuarioBase,
    fechaModificacion: value.fechaModificacion || fechaActual
  };
};

const UnidadCargaModel = (sequelize) => {
  return sequelize.define(
    'TCL_UnidadCarga',
    {
      id_unidad: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: 'id_unidad'
      },
      id_puerto: { type: DataTypes.STRING(50), allowNull: false },
      codigoUnidad: { type: DataTypes.STRING(30), allowNull: false },
      tipoContenedor: { type: DataTypes.STRING(30), allowNull: false },
      naviera: { type: DataTypes.STRING(80), allowNull: false },
      condicionCarga: { type: DataTypes.STRING(20), allowNull: false },
      esReefer: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      diasFreeTime: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 5 },
      temperaturaSet: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },

      // Auditoría QPLUS
      codigoUsuarioCreacion: { type: DataTypes.STRING(200), allowNull: true },
      fechaCreacion: { type: DataTypes.STRING(100), allowNull: true },
      codigoUsuarioModificacion: { type: DataTypes.STRING(200), allowNull: true },
      fechaModificacion: { type: DataTypes.STRING(100), allowNull: true }
    },
    {
      tableName: 'TCL_UnidadCarga',
      schema: 'dbo',
      timestamps: false
    }
  );
};

module.exports = { UnidadCargaModel, UnidadCargaDTO, UnidadCargaSchema };