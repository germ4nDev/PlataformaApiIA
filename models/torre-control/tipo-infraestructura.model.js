/*
    Author: German Valencia
    Pattern: PORTTOS DTO Pattern - Maestro Tipos de Infraestructura
*/
const Joi = require('joi');
const { DataTypes, Sequelize } = require('sequelize');

// 1. EL ESCUDO: Validación de entrada
const TipoInfraestructuraSchema = Joi.object({
  codigo_tipo: Joi.string().max(100).required(),        // Ej: 'PATIO', 'BODEGA'
  nombre: Joi.string().max(100).required(),
  descripcion: Joi.string().max(4000).allow('', null),
  color_ui: Joi.string().max(20).allow('', null),
  estado: Joi.bool().default(true),
});

// 2. EL ENSAMBLADOR: DTO con auditoría PORTTOS
const TipoInfraestructuraDTO = (rawData, userContext = { codigoUsuario: 'SISTEMA_ADMIN' }) => {
  // 🟢 CORRECCIÓN: Usamos el Schema correcto
  const { error, value } = TipoInfraestructuraSchema.validate(rawData, { abortEarly: false, stripUnknown: true });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  return {
    codigo_tipo: value.codigo_tipo.trim().toUpperCase(),
    nombre: value.nombre.trim(),
    descripcion: value.descripcion ? value.descripcion.trim() : null,
    color_ui: value.color_ui ? value.color_ui.trim() : null,
    estado: value.estado,

    // Auditoría PORTTOS (Estos sí existen en tu tabla según la imagen)
    usuario_cargue: userContext.codigoUsuario,
    fecha_cargue: new Date().toISOString()
  };
};

// 3. EL MAPEO: Definición en Sequelize (Basado en la imagen)
const TipoInfraestructuraModel = (sequelize) => {
  return sequelize.define('T_Tipo_Infraestructura', {
    id_tipo: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    codigo_tipo: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    nombre: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    descripcion: {
      type: DataTypes.STRING(4000),
      allowNull: true
    },
    color_ui: { type: DataTypes.STRING(20), allowNull: true },
    estado: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    usuario_cargue: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    fecha_cargue: {
      type: DataTypes.STRING(100),
      allowNull: false
    }
  }, {
    // ⚠️ IMPORTANTE: Cambia esto por el nombre real de tu tabla en SQL Server
    tableName: 'T_Tipos_Infraestructura',
    schema: 'dbo',
    timestamps: false
  });
};

module.exports = { TipoInfraestructuraModel, TipoInfraestructuraDTO, TipoInfraestructuraSchema };