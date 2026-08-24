/*
    Author: German Valencia
    Pattern: QPLUS DTO Pattern - Catálogo de Widgets (Lobby)
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

// 1. EL ESCUDO: Validación de metadatos del catálogo
const CatalogoWidgetSchema = Joi.object({
  codigo_widget: Joi.string().max(100).required(),
  nombre: Joi.string().max(150).required(),
  pestana: Joi.string().max(500).allow('', null).optional(),
  descripcion: Joi.string().max(500).allow('', null).optional(),
  categoria: Joi.string().max(100).default('MARITIMO'),
  componente_angular: Joi.string().max(150).required(),
  cols_defecto: Joi.number().integer().min(1).max(12).default(2),
  rows_defecto: Joi.number().integer().min(1).max(12).default(2),
  thumbnail_url: Joi.string().max(100).allow('', null).optional(),
  activo: Joi.boolean().default(true)
});

// 2. EL ENSAMBLADOR: DTO para sanear y aplicar auditoría antes de T-SQL
const CatalogoWidgetDTO = (rawData, userContext = { codigoUsuario: 'SISTEMA_ADMIN' }) => {
  const { error, value } = CatalogoWidgetSchema.validate(rawData, { abortEarly: false, stripUnknown: true });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  return {
    codigo_widget: value.codigo_widget.trim().toUpperCase(),
    nombre: value.nombre.trim(),
    pestana: value.pestana ? value.pestana.trim() : null,
    descripcion: value.descripcion ? value.descripcion.trim() : null,
    categoria: value.categoria.trim().toUpperCase(),
    componente_angular: value.componente_angular.trim(),
    cols_defecto: value.cols_defecto,
    rows_defecto: value.rows_defecto,
    thumbnail_url: value.thumbnail_url || 'default-thumb.png',
    activo: value.activo,

    // Auditoría
    usuario_cargue: userContext.codigoUsuario,
    fecha_cargue: new Date().toISOString()
  };
};

// 3. EL MAPEO: Definición de Sequelize
const CatalogoWidgetModel = (sequelize) => {
  return sequelize.define('TLCCatalogo_Widgets', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, field: 'id' },
    codigo_widget: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    nombre: { type: DataTypes.STRING(150), allowNull: false },
    pestana: { type: DataTypes.STRING(150) },
    descripcion: { type: DataTypes.STRING(500) },
    categoria: { type: DataTypes.STRING(100), allowNull: false },
    componente_angular: { type: DataTypes.STRING(150), allowNull: false },
    cols_defecto: { type: DataTypes.INTEGER, allowNull: false },
    rows_defecto: { type: DataTypes.INTEGER, allowNull: false },
    thumbnail_url: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: 'default-thumb.png'
    },
    activo: { type: DataTypes.BOOLEAN, allowNull: false },
    usuario_cargue: { type: DataTypes.STRING(200), allowNull: false },
    fecha_cargue: { type: DataTypes.STRING(100), allowNull: false }
  }, {
    tableName: 'TLCCatalogo_Widgets',
    schema: 'dbo',
    timestamps: false
  });
};

module.exports = { CatalogoWidgetModel, CatalogoWidgetDTO, CatalogoWidgetSchema };