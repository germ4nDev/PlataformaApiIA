/*
    Author: German Valencia
    Pattern: QPLUS DTO Pattern - Nodos de Monitoreo (Master Data)
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

// 1. EL ESCUDO: Validación Joi
const NodoMonitoreoSchema = Joi.object({
  corredorVial: Joi.string().max(150).required(),
  nombreSector: Joi.string().max(100).required(),
  latitud: Joi.number().min(-90).max(90).required(),
  longitud: Joi.number().min(-180).max(180).required(),
  estado: Joi.string().valid('ACTIVO', 'INACTIVO').default('ACTIVO')
});

// 2. EL ENSAMBLADOR: DTO
const NodoMonitoreoDTO = (rawData, userContext) => {
  const { error, value } = NodoMonitoreoSchema.validate(rawData, { abortEarly: false, stripUnknown: true });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  return {
    codigoNodo: uuidv4(),
    corredorVial: value.corredorVial.trim(),
    nombreSector: value.nombreSector.trim().toUpperCase(),
    latitud: value.latitud,
    longitud: value.longitud,
    estado: value.estado,

    // Auditoría QPLUS
    codigoUsuarioCreacion: userContext.codigoUsuario,
    fechaCreacion: new Date(),
    codigoUsuarioModificacion: userContext.codigoUsuario,
    fechaModificacion: new Date()
  };
};

// 3. EL MAPEO: Modelo Sequelize
const NodoMonitoreoModel = (sequelize) => {
  return sequelize.define('TCLNodosMonitoreo', {
    codigoNodo: {
      type: DataTypes.STRING(36),
      primaryKey: true,
      allowNull: false
    },
    corredorVial: {
      type: DataTypes.STRING(150),
      allowNull: false
    },
    nombreSector: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    latitud: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: false
    },
    longitud: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: false
    },
    estado: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'ACTIVO'
    },
    codigoUsuarioCreacion: { type: DataTypes.STRING(200), allowNull: false },
    fechaCreacion: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    codigoUsuarioModificacion: { type: DataTypes.STRING(200), allowNull: true },
    fechaModificacion: { type: DataTypes.DATE, allowNull: true }
  }, {
    tableName: 'TCLNodosMonitoreo',
    timestamps: false
  });
};

module.exports = {
  NodoMonitoreoModel,
  NodoMonitoreoDTO,
  NodoMonitoreoSchema
};