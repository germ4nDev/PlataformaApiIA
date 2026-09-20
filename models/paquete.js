/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization, Joi Validation & SQL Server precision
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const PaqueteSchema = Joi.object({
  codigoPaquete: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código único del paquete es obligatorio.' }),
  codigoTipoPaquete: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código del tipo de paquete es obligatorio.' }),

  nombrePaquete: Joi.string().max(100).required()
    .messages({ 'any.required': 'El nombre comercial del paquete es obligatorio.' }),

  descripcionPaquete: Joi.string().max(4000).allow('', null).optional(),
  acuerdoLicencia: Joi.string().max(4000).allow('', null).optional(),
  // costoPaquete: Joi.number().precision(2).min(0).optional().default(0.00),
  // precioPaquete: Joi.number().precision(2).min(0).optional().default(0.00),
  // precioPromocion: Joi.number().precision(2).min(0).optional().default(0.00),
  // valorAnual: Joi.number().precision(2).min(0).optional().default(0.00),
  // valorMensual: Joi.number().precision(2).min(0).optional().default(0.00),
  imagenPaquete: Joi.string().max(100).allow('', null).optional().default('no-imagen.png'),
  iconoPaquete: Joi.string().max(100).allow('', null).optional().default('default-icon'),
  colorPaquete: Joi.string().max(100).allow('', null).optional().default('#FFFFFF'),
  // promocion: Joi.boolean().optional().default(false),
  estadoPaquete: Joi.boolean().optional().default(true),

  codigoUsuarioCreacion: Joi.string().max(200).required(),
  fechaCreacion: Joi.string().max(100).required(),
  codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
  fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const PaqueteDTO = (rawData) => {
  const { error, value } = PaqueteSchema.validate(rawData, { abortEarly: false });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const fechaActual = new Date().toISOString();

  return {
    codigoPaquete: value.codigoPaquete.trim(),
    codigoTipoPaquete: value.codigoTipoPaquete.trim(),
    nombrePaquete: value.nombrePaquete.trim(),
    descripcionPaquete: value.descripcionPaquete.trim(),
    acuerdoLicencia: value.acuerdoLicencia.trim(),
    // costoPaquete: value.costoPaquete,
    // precioPaquete: value.precioPaquete,
    // precioPromocion: value.precioPromocion,
    // valorAnual: value.valorAnual,
    // valorMensual: value.valorMensual,
    imagenPaquete: value.imagenPaquete.trim(),
    iconoPaquete: value.iconoPaquete.trim(),
    colorPaquete: value.colorPaquete.trim(),
    // promocion: value.promocion,
    estadoPaquete: value.estadoPaquete,

    codigoUsuarioCreacion: value.codigoUsuarioCreacion,
    fechaCreacion: value.fechaCreacion || fechaActual,
    codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
    fechaModificacion: value.fechaModificacion || fechaActual
  };
};

const PaqueteModel = (sequelize) => {
  return sequelize.define('PTLPaquetes', {
    paqueteId: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      allowNull: false
    },
    codigoPaquete: {
      type: DataTypes.STRING(200),
      primaryKey: true,
      allowNull: false,
      unique: true
    },
    codigoTipoPaquete: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    nombrePaquete: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    descripcionPaquete: {
      type: DataTypes.STRING(4000),
      allowNull: true
    },
    acuerdoLicencia: {
      type: DataTypes.STRING(4000),
      allowNull: true
    },
    // costoPaquete: {
    //   type: DataTypes.DECIMAL(18, 2),
    //   allowNull: false,
    //   defaultValue: 0.00
    // },
    // precioPaquete: {
    //   type: DataTypes.DECIMAL(18, 2),
    //   allowNull: false,
    //   defaultValue: 0.00
    // },
    // precioPromocion: {
    //   type: DataTypes.DECIMAL(18, 2),
    //   allowNull: false,
    //   defaultValue: 0.00
    // },
    // valorAnual: {
    //   type: DataTypes.DECIMAL(18, 2),
    //   allowNull: false,
    //   defaultValue: 0.00
    // },
    // valorMensual: {
    //   type: DataTypes.DECIMAL(18, 2),
    //   allowNull: false,
    //   defaultValue: 0.00
    // },
    imagenPaquete: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    iconoPaquete: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    colorPaquete: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    // promocion: {
    //   type: DataTypes.BOOLEAN,
    //   allowNull: false,
    //   defaultValue: false
    // },
    estadoPaquete: {
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
    tableName: 'PTLPaquetes',
    timestamps: false
  });
};

module.exports = {
  PaqueteModel,
  PaqueteDTO,
  PaqueteSchema
};