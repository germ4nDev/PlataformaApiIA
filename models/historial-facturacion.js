/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Primary Key Standardization & Joi Validation
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const HistorialFacturacionSchema = Joi.object({
  codigoHistorial: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código del historial es obligatorio.' }),

  codigoSuscriptor: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código del suscriptor es obligatorio.' }),

  codigoLicencia: Joi.string().max(200).required(),

  codigoTipoPago: Joi.string().max(200).required(),

  codigoPaquete: Joi.string().max(200).required(),

  fechaPago: Joi.string().max(100).required(),

  numFactura: Joi.string().max(100).allow('', null).optional(),

  montoPagado: Joi.number().integer().required()
    .messages({
      'any.required': 'El monto pagado es obligatorio.',
      'number.base': 'El monto pagado debe ser un número válido.'
    }),
  numeroCuota: Joi.number().integer().required()
    .messages({
      'any.required': 'El numeroCuota es obligatorio.',
      'number.base': 'El numeroCuota debe ser un número válido.'
    }),

  estadoPago: Joi.boolean().optional().default(true),

  // Campos de auditoría (La BD permite nulos en todos según la imagen)
  codigoUsuarioCreacion: Joi.string().max(200).allow('', null).optional(),
  fechaCreacion: Joi.string().max(100).allow('', null).optional(),
  codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
  fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const HistorialFacturacionDTO = (rawData) => {
  const { error, value } = HistorialFacturacionSchema.validate(rawData, { abortEarly: false });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const fechaActual = new Date().toISOString();

  return {
    codigoHistorial: value.codigoHistorial.trim(),
    codigoSuscriptor: value.codigoSuscriptor.trim(),
    codigoLicencia: value.codigoLicencia.trim(),
    codigoTipoPago: value.codigoTipoPago.trim(),
    codigoPaquete: value.codigoPaquete.trim(),
    fechaPago: value.fechaPago.trim(),
    numFactura: value.numFactura.trim(),
    montoPagado: value.montoPagado,
    numeroCuota: value.numeroCuota,

    // Mapeado exactamente con el nombre de la BD (estadoPPago)
    estadoPago: value.estadoPago,

    codigoUsuarioCreacion: value.codigoUsuarioCreacion,
    fechaCreacion: value.fechaCreacion || fechaActual,
    codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
    fechaModificacion: value.fechaModificacion || fechaActual
  };
};

const HistorialFacturacionModel = (sequelize) => {
  return sequelize.define('PTLHistorialFacturacion', {
    historialId: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      allowNull: false
    },
    codigoHistorial: {
      type: DataTypes.STRING(200),
      primaryKey: true,
      allowNull: false
    },
    codigoSuscriptor: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    codigoLicencia: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    codigoTipoPago: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    codigoPaquete: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    fechaPago: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    numFactura: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    montoPagado: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    numeroCuota: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    estadoPago: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },

    codigoUsuarioCreacion: {
      type: DataTypes.STRING(200),
      allowNull: true
    },
    fechaCreacion: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    codigoUsuarioModificacion: {
      type: DataTypes.STRING(200),
      allowNull: true
    },
    fechaModificacion: {
      type: DataTypes.STRING(100),
      allowNull: true
    }
  }, {
    tableName: 'PTLHistorialFacturacion',
    timestamps: false
  });
};

module.exports = {
  HistorialFacturacionModel,
  HistorialFacturacionDTO,
  HistorialFacturacionSchema
};