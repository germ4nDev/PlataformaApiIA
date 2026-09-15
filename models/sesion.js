/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization, Joi Validation & SQL Server precision
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const SesionSchema = Joi.object({
  codigoSesion: Joi.string().max(200).required(),
  codigoUsuario: Joi.string().max(200).required(),
  codigoSuscriptor: Joi.string().max(200).allow('', null).optional(),
  codigoSuite: Joi.string().max(200).allow('', null).optional(),
  codigoAplicacion: Joi.string().max(200).allow('', null).optional(),
  codigoModulo: Joi.string().max(200).allow('', null).optional().default('Dashboard Principal'),
  nombreUsuario: Joi.string().max(100).required(),
  rol: Joi.string().max(100).allow('', null).optional().default('Suscriptor'),
  correo: Joi.string().email().max(200).allow('', null).optional(),
  dispositivo: Joi.string().max(200).allow('', null).optional().default('Desktop'),
  activa: Joi.boolean().optional().default(true),
  fechaLogin: Joi.string().max(100).required(),
  fechaLogout: Joi.string().max(100).allow('', null).optional()
});

const SesionDTO = (rawData) => {
  const { error, value } = SesionSchema.validate(rawData, { abortEarly: false, stripUnknown: true });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const fechaActual = new Date().toISOString();

  return {
    codigoSesion: value.codigoSesion.trim(),
    codigoUsuario: value.codigoUsuario.trim(),
    codigoSuscriptor: value.codigoSuscriptor ? value.codigoSuscriptor.trim() : null,
    codigoSuite: value.codigoSuite ? value.codigoSuite.trim() : null,
    codigoAplicacion: value.codigoAplicacion ? value.codigoAplicacion.trim() : null,
    codigoModulo: value.codigoModulo ? value.codigoModulo.trim() : 'Dashboard Principal',
    nombreUsuario: value.nombreUsuario.trim().toUpperCase(),
    rol: value.rol.trim(),
    correo: value.correo ? value.correo.trim().toLowerCase() : null,
    dispositivo: value.dispositivo.trim(),
    activa: value.activa,
    fechaLogin: value.fechaLogin || fechaActual,
    fechaLogout: value.fechaLogout || null
  };
};

const SesionModel = (sequelize) => {
  return sequelize.define('PTLSesiones', {
    sesionId: { type: DataTypes.INTEGER, autoIncrement: true },
    codigoSesion: { type: DataTypes.STRING(200), primaryKey: true, allowNull: false },
    codigoUsuario: { type: DataTypes.STRING(200), allowNull: false },
    codigoSuscriptor: { type: DataTypes.STRING(200), allowNull: true },
    codigoSuite: { type: DataTypes.STRING(200), allowNull: true },
    codigoAplicacion: { type: DataTypes.STRING(200), allowNull: true },
    codigoModulo: { type: DataTypes.STRING(200), allowNull: true, defaultValue: 'Dashboard Principal' },
    nombreUsuario: { type: DataTypes.STRING(100), allowNull: false },
    rol: { type: DataTypes.STRING(100), allowNull: true, defaultValue: 'Suscriptor' },
    correo: { type: DataTypes.STRING(200), allowNull: true },
    dispositivo: { type: DataTypes.STRING(200), allowNull: true },
    activa: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    fechaLogin: { type: DataTypes.STRING(100), allowNull: false },
    fechaLogout: { type: DataTypes.STRING(100), allowNull: true }
  }, {
    tableName: 'PTLSesiones',
    timestamps: false
  });
};

module.exports = {
  SesionModel,
  SesionDTO,
  SesionSchema
};