/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization, Joi Validation & SQL Server precision
    Table: T_Nominaciones_Gas
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const NominacionesGasSchema = Joi.object({
  id_nominacion: Joi.string().guid({ version: ['uuidv4'] }).optional(),
  id_puerto: Joi.string().max(50).required(),
  cliente: Joi.string().max(150).required(),

  // Solo la fecha (YYYY-MM-DD)
  fecha_operacion: Joi.string().max(100).required(),

  volumen_solicitado_mmbtu: Joi.number().precision(4).required(),
  volumen_entregado_mmbtu: Joi.number().precision(4).optional().default(0),
  estado_cumplimiento: Joi.string().max(50).optional().default('PROGRAMADA'),

  codigoUsuarioCreacion: Joi.string().max(100).required(),
  fechaCreacion: Joi.string().max(100).optional(),
  codigoUsuarioModificacion: Joi.string().max(100).allow('', null).optional(),
  fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const NominacionesGasDTO = (rawData) => {
  const { error, value } = NominacionesGasSchema.validate(rawData, { abortEarly: false, stripUnknown: true });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const fechaActual = new Date().toISOString();
  const crypto = require('crypto');

  return {
    id_nominacion: value.id_nominacion || crypto.randomUUID(),
    id_puerto: value.id_puerto.trim().toUpperCase(),
    cliente: value.cliente.trim().toUpperCase(),

    fecha_operacion: value.fecha_operacion,

    volumen_solicitado_mmbtu: value.volumen_solicitado_mmbtu,
    volumen_entregado_mmbtu: value.volumen_entregado_mmbtu || 0,
    estado_cumplimiento: value.estado_cumplimiento.trim().toUpperCase(),

    codigoUsuarioCreacion: value.codigoUsuarioCreacion,
    fechaCreacion: value.fechaCreacion || fechaActual,
    codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
    fechaModificacion: value.fechaModificacion || fechaActual
  };
};

const NominacionesGasModel = (sequelize) => {
  return sequelize.define('PTLNominacionesGas', {
    id_nominacion: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    id_puerto: { type: DataTypes.STRING(50), allowNull: false },
    cliente: { type: DataTypes.STRING(150), allowNull: false },

    fecha_operacion: { type: DataTypes.STRING(100), allowNull: false },

    volumen_solicitado_mmbtu: { type: DataTypes.DECIMAL(18, 4), allowNull: false },
    volumen_entregado_mmbtu: { type: DataTypes.DECIMAL(18, 4), defaultValue: 0 },
    estado_cumplimiento: { type: DataTypes.STRING(50), defaultValue: 'PROGRAMADA' },

    codigoUsuarioCreacion: { type: DataTypes.STRING(100), allowNull: true },
    fechaCreacion: { type: DataTypes.STRING(100), allowNull: true },
    codigoUsuarioModificacion: { type: DataTypes.STRING(100), allowNull: true },
    fechaModificacion: { type: DataTypes.STRING(100), allowNull: true }
  }, {
    tableName: 'T_Nominaciones_Gas',
    timestamps: false
  });
};

module.exports = {
  NominacionesGasModel,
  NominacionesGasDTO,
  NominacionesGasSchema
};