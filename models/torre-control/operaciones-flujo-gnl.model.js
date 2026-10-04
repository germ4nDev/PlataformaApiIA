/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization, Joi Validation & SQL Server precision
    Table: TCL_Operaciones_FlujoGNL (Cold Path Aggregation)
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const OperacionesFlujoGNLSchema = Joi.object({
  id_flujo: Joi.string().guid({ version: ['uuidv4'] }).optional(),
  id_puerto: Joi.string().max(50).required(),
  codigo_segmento: Joi.string().max(50).required(),

  fecha_inicio_lectura: Joi.string().max(100).required(),
  fecha_fin_lectura: Joi.string().max(100).required(),

  presion_promedio_psi: Joi.number().precision(2).required(),
  temperatura_promedio_celsius: Joi.number().precision(2).required(),
  flujo_total_m3: Joi.number().precision(2).required(),
  bog_calculado_m3: Joi.number().precision(2).optional().default(0),

  energia_total_mmbtu: Joi.number().precision(4).required(),
  alertas_disparadas: Joi.number().integer().optional().default(0),

  codigoUsuarioCreacion: Joi.string().max(100).optional().default('SYSTEM_WORKER'),
  fechaCreacion: Joi.string().max(100).optional()
});

const OperacionesFlujoGNLDTO = (rawData) => {
  const { error, value } = OperacionesFlujoGNLSchema.validate(rawData, { abortEarly: false, stripUnknown: true });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const fechaActual = new Date().toISOString();
  const crypto = require('crypto');

  return {
    id_flujo: value.id_flujo || crypto.randomUUID(),
    id_puerto: value.id_puerto.trim().toUpperCase(),
    codigo_segmento: value.codigo_segmento.trim().toUpperCase(),

    fecha_inicio_lectura: value.fecha_inicio_lectura,
    fecha_fin_lectura: value.fecha_fin_lectura,

    presion_promedio_psi: value.presion_promedio_psi,
    temperatura_promedio_celsius: value.temperatura_promedio_celsius,
    flujo_total_m3: value.flujo_total_m3,
    bog_calculado_m3: value.bog_calculado_m3 || 0,

    energia_total_mmbtu: value.energia_total_mmbtu,
    alertas_disparadas: value.alertas_disparadas || 0,

    codigoUsuarioCreacion: value.codigoUsuarioCreacion,
    fechaCreacion: value.fechaCreacion || fechaActual
  };
};

const OperacionesFlujoGNLModel = (sequelize) => {
  return sequelize.define('PTLOperacionesFlujoGNL', {
    id_flujo: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    id_puerto: { type: DataTypes.STRING(50), allowNull: false },
    codigo_segmento: { type: DataTypes.STRING(50), allowNull: false },

    // Tratados como string para asegurar la precisión ISO sin saltos de TimeZone en la BD
    fecha_inicio_lectura: { type: DataTypes.STRING(100), allowNull: false },
    fecha_fin_lectura: { type: DataTypes.STRING(100), allowNull: false },

    presion_promedio_psi: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    temperatura_promedio_celsius: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    flujo_total_m3: { type: DataTypes.DECIMAL(18, 2), allowNull: false },
    bog_calculado_m3: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },

    energia_total_mmbtu: { type: DataTypes.DECIMAL(18, 4), allowNull: false },
    alertas_disparadas: { type: DataTypes.INTEGER, defaultValue: 0 },

    codigoUsuarioCreacion: { type: DataTypes.STRING(100), defaultValue: 'SYSTEM_WORKER' },
    fechaCreacion: { type: DataTypes.STRING(100), allowNull: true }
  }, {
    tableName: 'TCL_Operaciones_FlujoGNL',
    timestamps: false
  });
};

module.exports = {
  OperacionesFlujoGNLModel,
  OperacionesFlujoGNLDTO,
  OperacionesFlujoGNLSchema
};