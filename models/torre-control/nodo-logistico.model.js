/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization, Joi Validation
    Entity: Maestro de Nodos Logísticos (Patios, Terminales, Bodegas y Mapa)
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const NodoLogisticoSchema = Joi.object({
  id_puerto: Joi.string().max(50).required(),
  nombre_nodo: Joi.string().max(150).required(),
  tipo_nodo: Joi.string().max(60).default('patio_contenedores'),
  capacidad_teus: Joi.number().integer().min(0).default(0),
  ocupacion_actual_pct: Joi.number().min(0).max(100).default(0),
  estado_operativo: Joi.string().max(40).default('libre'),
  geometria_wkt: Joi.string().allow('', null).optional(),
  color_ui: Joi.string().max(20).allow('', null).optional(),
  activo: Joi.boolean().required().default(true),

  // Auditoría Estándar QPLUS
  codigoUsuarioCreacion: Joi.string().max(200).allow('', null).optional(),
  fechaCreacion: Joi.string().max(100).allow('', null).optional(),
  codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
  fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const NodoLogisticoDTO = (rawData, userContext = { codigoUsuario: 'SISTEMA_ADMIN' }) => {
  const { error, value } = NodoLogisticoSchema.validate(rawData, {
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
    nombre_nodo: value.nombre_nodo.trim(),
    tipo_nodo: value.tipo_nodo.trim().toLowerCase(),
    capacidad_teus: value.capacidad_teus,
    ocupacion_actual_pct: Number(value.ocupacion_actual_pct),
    estado_operativo: value.estado_operativo.trim().toLowerCase(),
    geometria_wkt: value.geometria_wkt ? value.geometria_wkt.trim() : null,
    color_ui: value.color_ui || '#38bdf8',
    activo: value.activo,

    // Auditoría QPLUS
    codigoUsuarioCreacion: usuarioBase,
    fechaCreacion: value.fechaCreacion || fechaActual,
    codigoUsuarioModificacion: value.codigoUsuarioModificacion || usuarioBase,
    fechaModificacion: value.fechaModificacion || fechaActual
  };
};

const NodoLogisticoModel = (sequelize) => {
  return sequelize.define(
    'T_Maestro_NodosLogisticos',
    {
      id_nodo: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: 'id_nodo'
      },
      id_puerto: { type: DataTypes.STRING(50), allowNull: false },
      nombre_nodo: { type: DataTypes.STRING(150), allowNull: false },
      tipo_nodo: { type: DataTypes.STRING(60), allowNull: false },
      capacidad_teus: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      ocupacion_actual_pct: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0
      },
      estado_operativo: { type: DataTypes.STRING(40), allowNull: false },
      geometria_wkt: { type: DataTypes.TEXT, allowNull: true },
      color_ui: { type: DataTypes.STRING(20), allowNull: true },
      activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },

      // Auditoría QPLUS
      codigoUsuarioCreacion: { type: DataTypes.STRING(200), allowNull: true },
      fechaCreacion: { type: DataTypes.STRING(100), allowNull: true },
      codigoUsuarioModificacion: { type: DataTypes.STRING(200), allowNull: true },
      fechaModificacion: { type: DataTypes.STRING(100), allowNull: true }
    },
    {
      tableName: 'T_Maestro_NodosLogisticos',
      schema: 'dbo',
      timestamps: false
    }
  );
};

module.exports = { NodoLogisticoModel, NodoLogisticoDTO, NodoLogisticoSchema };