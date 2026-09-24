/*
    Author: German Valencia
    Pattern: PORTTOS DTO Pattern - Productividad Terminales
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

// 1. EL ESCUDO: Validación estricta de la data de productividad
const ProductividadTerminalesSchema = Joi.object({
  puerto: Joi.string().max(50).required(),
  terminal: Joi.string().max(50).required(),
  fecha: Joi.date().iso().required(),
  horaEtiqueta: Joi.string().regex(/^[0-2][0-9]h$/).required(), // Ej: '06h', '14h'
  movimientosHora: Joi.number().integer().min(0).required()
});

// 2. EL ENSAMBLADOR: Construcción del DTO seguro y aplicación de auditoría
const ProductividadTerminalesDTO = (rawData, userContext) => {
  const { error, value } = ProductividadTerminalesSchema.validate(rawData, { abortEarly: false, stripUnknown: true });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  return {
    puerto: value.puerto.trim().toUpperCase(),
    terminal: value.terminal.trim().toUpperCase(),

    // Texto puro de 10 caracteres: '2026-06-23'
    fecha: value.fecha.toISOString().split('T')[0],

    horaEtiqueta: value.horaEtiqueta.trim().toLowerCase(),
    movimientosHora: value.movimientosHora,

    // Auditoría PORTTOS: Texto puro ISO largo directo a la BD
    codigoUsuarioCreacion: userContext ? userContext.codigoUsuario : 'CRON_SYS',
    fechaCreacion: new Date().toISOString(),
    codigoUsuarioModificacion: userContext ? userContext.codigoUsuario : 'CRON_SYS',
    fechaModificacion: new Date().toISOString()
  };
};

// 3. EL MAPEO: Definición de Sequelize para TCLProductividadTerminales
const ProductividadTerminalesModel = (sequelize) => {
  return sequelize.define('TCLProductividadTerminales', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
      field: 'id'
    },
    puerto: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'puerto'
    },
    terminal: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'terminal'
    },
    fecha: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'fecha'
    },
    horaEtiqueta: {
      type: DataTypes.STRING(5),
      allowNull: false,
      field: 'horaEtiqueta'
    },
    movimientosHora: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'movimientosHora'
    },
    codigoUsuarioCreacion: {
      type: DataTypes.STRING(200),
      allowNull: false,
      field: 'codigoUsuarioCreacion'
    },
    fechaCreacion: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'fechaCreacion'
    },
    codigoUsuarioModificacion: {
      type: DataTypes.STRING(200),
      allowNull: true,
      field: 'codigoUsuarioModificacion'
    },
    fechaModificacion: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'fechaModificacion'
    }
  }, {
    tableName: 'TCLProductividadTerminales',
    schema: 'dbo',
    timestamps: false
  });
};

module.exports = {
  ProductividadTerminalesModel,
  ProductividadTerminalesDTO,
  ProductividadTerminalesSchema
};