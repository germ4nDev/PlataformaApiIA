/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization, Collision Fix & Joi Validation
*/
const Joi = require('joi');
const { DataTypes } = require("sequelize");

const SuitePQSchema = Joi.object({
  codigoSuitePQ: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código de la suite para el paquete es obligatorio.' }),

  codigoPaquete: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código del paquete es obligatorio.' }),

  codigoSuite: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código de la suite es obligatorio.' }),

  estadoSuite: Joi.boolean().optional().default(true),

  codigoUsuarioCreacion: Joi.string().max(200).required(),
  fechaCreacion: Joi.string().max(100).required(),
  codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
  fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const SuitePQDTO = (rawData) => {
  const { error, value } = SuitePQSchema.validate(rawData, { abortEarly: false });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const fechaActual = new Date().toISOString();

  return {
    codigoSuitePQ: value.codigoSuitePQ.trim(),
    codigoPaquete: value.codigoPaquete.trim(),
    codigoSuite: value.codigoSuite.trim(),
    estadoSuite: value.estadoSuite,

    codigoUsuarioCreacion: value.codigoUsuarioCreacion,
    fechaCreacion: value.fechaCreacion || fechaActual,
    codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
    fechaModificacion: value.fechaModificacion || fechaActual
  };
};

const SuitePQModel = (sequelize) => {
  return sequelize.define("PTLSuitesPQ", {
    suitePaqueteId: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      allowNull: false
    },
    codigoSuitePQ: {
      type: DataTypes.STRING(200),
      primaryKey: true,
      allowNull: false,
    },
    codigoPaquete: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    codigoSuite: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    estadoSuite: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    },
    codigoUsuarioCreacion: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    fechaCreacion: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    codigoUsuarioModificacion: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    fechaModificacion: {
      type: DataTypes.STRING(100),
      allowNull: false
    }
  }, {
    tableName: "PTLSuitesPQ",
    timestamps: false,
  });
};

module.exports = {
  SuitePQModel,
  SuitePQDTO,
  SuitePQSchema
};