/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization, Joi Validation & SQL Server precision
    Table: T_Infraestructura_Tanques
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const InfraestructuraTanquesSchema = Joi.object({
  id_tanque: Joi.string().guid({ version: ['uuidv4'] }).optional(), // Opcional porque lo crea Node si no viene
  id_puerto: Joi.string().max(50).required(),
  codigo_tanque: Joi.string().max(50).required(),
  tipo_infraestructura: Joi.string().max(50).required(),
  capacidad_maxima_m3: Joi.number().precision(2).required(),
  presion_diseno_psi: Joi.number().precision(2).allow(null).optional(),
  tasa_evaporacion_bog_diaria: Joi.number().precision(2).allow(null).optional(),
  estado_operativo: Joi.string().max(50).optional().default('ACTIVO'),

  codigoUsuarioCreacion: Joi.string().max(100).required(),
  fechaCreacion: Joi.string().max(100).optional(),
  codigoUsuarioModificacion: Joi.string().max(100).allow('', null).optional(),
  fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const InfraestructuraTanquesDTO = (rawData) => {
  const { error, value } = InfraestructuraTanquesSchema.validate(rawData, { abortEarly: false, stripUnknown: true });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const fechaActual = new Date().toISOString();
  const crypto = require('crypto');

  return {
    id_tanque: value.id_tanque || crypto.randomUUID(),
    id_puerto: value.id_puerto.trim().toUpperCase(),
    codigo_tanque: value.codigo_tanque.trim().toUpperCase(),
    tipo_infraestructura: value.tipo_infraestructura.trim().toUpperCase(),
    capacidad_maxima_m3: value.capacidad_maxima_m3,
    presion_diseno_psi: value.presion_diseno_psi || null,
    tasa_evaporacion_bog_diaria: value.tasa_evaporacion_bog_diaria || null,
    estado_operativo: value.estado_operativo.trim().toUpperCase(),

    codigoUsuarioCreacion: value.codigoUsuarioCreacion,
    fechaCreacion: value.fechaCreacion || fechaActual,
    codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
    fechaModificacion: value.fechaModificacion || fechaActual
  };
};

const InfraestructuraTanquesModel = (sequelize) => {
  return sequelize.define('PTLInfraestructuraTanques', {
    id_tanque: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    id_puerto: { type: DataTypes.STRING(50), allowNull: false },
    codigo_tanque: { type: DataTypes.STRING(50), allowNull: false },
    tipo_infraestructura: { type: DataTypes.STRING(50), allowNull: false },
    capacidad_maxima_m3: { type: DataTypes.DECIMAL(18, 2), allowNull: false },
    presion_diseno_psi: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    tasa_evaporacion_bog_diaria: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
    estado_operativo: { type: DataTypes.STRING(50), defaultValue: 'ACTIVO' },

    codigoUsuarioCreacion: { type: DataTypes.STRING(100), allowNull: true },
    fechaCreacion: { type: DataTypes.STRING(100), allowNull: true },
    codigoUsuarioModificacion: { type: DataTypes.STRING(100), allowNull: true },
    fechaModificacion: { type: DataTypes.STRING(100), allowNull: true }
  }, {
    tableName: 'T_Infraestructura_Tanques',
    timestamps: false
  });
};

module.exports = {
  InfraestructuraTanquesModel,
  InfraestructuraTanquesDTO,
  InfraestructuraTanquesSchema
};