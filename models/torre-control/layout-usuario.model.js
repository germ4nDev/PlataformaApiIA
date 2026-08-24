/*
    Author: German Valencia
    Pattern: QPLUS DTO Pattern - Layout del Tablero por Usuario
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

// 1. EL ESCUDO: Validación de coordenadas y estado de Gridster
const LayoutUsuarioSchema = Joi.object({
  codigo_usuario: Joi.string().max(100).required(),
  codigo_widget: Joi.string().max(100).required(), // Debe coincidir con TLCCatalogo_Widgets
  codigoDashboard: Joi.string().max(100).required(), // Debe coincidir con TLCCatalogo_Widgets
  instancia: Joi.string().max(100).default('UNICA'),
  pos_x: Joi.number().integer().min(0).required(),
  pos_y: Joi.number().integer().min(0).required(),
  cols: Joi.number().integer().min(1).max(12).required(),
  rows: Joi.number().integer().min(1).max(12).required(),
  visible: Joi.boolean().default(true),
});

// 2. EL ENSAMBLADOR: DTO para sanear la configuración
const LayoutUsuarioDTO = (rawData, userContext = { codigoUsuario: 'SISTEMA_ADMIN' }) => {
  const { error, value } = LayoutUsuarioSchema.validate(rawData, { abortEarly: false, stripUnknown: true });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  return {
    codigo_usuario: value.codigo_usuario.trim(),
    codigo_widget: value.codigo_widget.trim().toUpperCase(),
    codigoDashboard: value.codigoDashborad.trim().toUpperCase(),
    instancia: value.instancia.trim().toUpperCase(),
    pos_x: value.pos_x,
    pos_y: value.pos_y,
    cols: value.cols,
    rows: value.rows,
    visible: value.visible,

    // Auditoría
    usuario_cargue: userContext.codigoUsuario,
    fecha_cargue: new Date().toISOString()
  };
};

// 3. EL MAPEO: Definición de Sequelize
const LayoutUsuarioModel = (sequelize) => {
  return sequelize.define('TLCLayout_Usuarios', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, field: 'id' },
    codigo_usuario: { type: DataTypes.STRING(100), allowNull: false },
    codigo_widget: { type: DataTypes.STRING(100), allowNull: false },
    codigoDashboard: { type: DataTypes.STRING(100), allowNull: false },
    instancia: { type: DataTypes.STRING(100), allowNull: false, defaultValue: 'UNICA' },
    pos_x: { type: DataTypes.INTEGER, allowNull: false },
    pos_y: { type: DataTypes.INTEGER, allowNull: false },
    cols: { type: DataTypes.INTEGER, allowNull: false },
    rows: { type: DataTypes.INTEGER, allowNull: false },
    visible: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    usuario_cargue: { type: DataTypes.STRING(200), allowNull: false },
    fecha_cargue: { type: DataTypes.STRING(100), allowNull: false }
  }, {
    tableName: 'TLCLayout_Usuarios',
    schema: 'dbo',
    timestamps: false
  });
};

module.exports = { LayoutUsuarioModel, LayoutUsuarioDTO, LayoutUsuarioSchema };