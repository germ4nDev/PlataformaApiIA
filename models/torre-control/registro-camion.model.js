/*
    Author: German Valencia
    Pattern: QPLUS DTO Pattern - Virtual Gate (Camiones en Operación)
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

// 1. EL ESCUDO: Validación Joi
const RegistroCamionSchema = Joi.object({
  placaVehiculo: Joi.string().alphanum().min(5).max(10).required(),

  tipoCarga: Joi.string().valid(
    'CONTENEDOR',
    'GRANEL',
    'VEHICULO',
    'CARGA_GENERAL'
  ).required(),

  codigoTerminal: Joi.string().max(50).required(),

  // Validamos estrictamente las 4 etapas de tu modelo analítico
  etapaOperativa: Joi.number().integer().valid(1, 2, 3, 4).required(),

  estadoRegistro: Joi.string().valid('EN_TRANSITO', 'FINALIZADO', 'CANCELADO').default('EN_TRANSITO'),

  fechaIngresoEtapa: Joi.date().iso().required()
});

// 2. EL ENSAMBLADOR: DTO
const RegistroCamionDTO = (rawData, userContext) => {
  const { error, value } = RegistroCamionSchema.validate(rawData, { abortEarly: false, stripUnknown: true });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  return {
    codigoRegistro: uuidv4(), // Plataforma 2.0 UUID

    // Normalizamos la placa para evitar duplicados por minúsculas/espacios
    placaVehiculo: value.placaVehiculo.trim().toUpperCase(),
    tipoCarga: value.tipoCarga,
    codigoTerminal: value.codigoTerminal.trim().toUpperCase(),
    etapaOperativa: value.etapaOperativa,
    estadoRegistro: value.estadoRegistro,
    fechaIngresoEtapa: value.fechaIngresoEtapa,

    // Auditoría QPLUS
    codigoUsuarioCreacion: userContext.codigoUsuario,
    fechaCreacion: new Date(),
    codigoUsuarioModificacion: userContext.codigoUsuario,
    fechaModificacion: new Date()
  };
};

// 3. EL MAPEO: Modelo Sequelize
const RegistroCamionModel = (sequelize) => {
  return sequelize.define('TCLRegistroCamiones', {
    codigoRegistro: {
      type: DataTypes.STRING(36),
      primaryKey: true,
      allowNull: false
    },
    placaVehiculo: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    tipoCarga: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    codigoTerminal: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    etapaOperativa: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    estadoRegistro: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'EN_TRANSITO'
    },
    fechaIngresoEtapa: {
      type: DataTypes.DATE,
      allowNull: false
    },

    // Auditoría QPLUS
    codigoUsuarioCreacion: { type: DataTypes.STRING(200), allowNull: false },
    fechaCreacion: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    codigoUsuarioModificacion: { type: DataTypes.STRING(200), allowNull: true },
    fechaModificacion: { type: DataTypes.DATE, allowNull: true }
  }, {
    tableName: 'TCLRegistroCamiones',
    timestamps: false
  });
};

module.exports = {
  RegistroCamionModel,
  RegistroCamionDTO,
  RegistroCamionSchema
};