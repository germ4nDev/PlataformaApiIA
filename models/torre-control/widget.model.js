/*
    Author: German Valencia
    Pattern: QPLUS DTO Pattern - Maestro de Widgets
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const TerminalSchema = Joi.object({
  id: Joi.number().integer().min(0).default(0),
  codigo_widget: Joi.string().max(200).required(), // Aseguramos que cruce bien con el puerto
  nombre: Joi.string().max(150).required(),
  pestana: Joi.string().max(150).required(),
  descripcion: Joi.string().max(4000).allow('', null),
  categoria: Joi.string().max(100).required(),
  componente_angular: Joi.string().max(150).required(),
  cols_defecto: Joi.number().integer().min(0).default(0),
  rows_defecto: Joi.number().integer().min(0).default(0),
  thumbnail_url: Joi.string().max(100).allow('', null),
  activo: Joi.bool().default(true),
});

const WidgetlDTO = (rawData, userContext = { codigoUsuario: 'SISTEMA_ADMIN' }) => {
  const { error, value } = TerminalSchema.validate(rawData, { abortEarly: false, stripUnknown: true });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  return {
    id: value.id.trim().toUpperCase(),
    codigo_widget: value.codigo_widget.trim().toUpperCase(), // Aseguramos que cruce bien con el puerto
    nombre: value.nombre.trim(),
    pestana: value.pestana.trim(),
    descripcion: value.descripcion ? value.descripcion.trim() : null,
    categoria: value.categoria ? value.categoria.trim() : null,
    componente_angular: value.componente_angular.trim(),
    cols_defecto: value.cols_defecto,
    rows_defecto: value.rows_defecto,
    thumbnail_url: value.thumbnail_url.trim(),
    activo: value.activo,

    // Auditoría QPLUS
    usuario_cargue: userContext.codigoUsuario,
    fecha_cargue: new Date().toISOString()
  };
};

// 3. EL MAPEO: Definición de la entidad en Sequelize
const WidgetModel = (sequelize) => {
  return sequelize.define('T_Maestro_Terminales', {
    id: { type: DataTypes.STRING(50), primaryKey: true, allowNull: false, field: 'id' },
    codigo_widget: { type: DataTypes.STRING(200), allowNull: false },
    nombre: { type: DataTypes.STRING(150), allowNull: false },
    pestana: { type: DataTypes.STRING(150), allowNull: false },
    descripcion: { type: DataTypes.STRING(4000), allowNull: true },
    categoria: { type: DataTypes.STRING(100), allowNull: false },
    componente_angular: { type: DataTypes.STRING(150), allowNull: false },
    cols_defecto: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
    rows_defecto: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
    thumbnail_url: { type: DataTypes.STRING(150), allowNull: true },
    activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    usuario_cargue: { type: DataTypes.STRING(200), allowNull: false },
    fecha_cargue: { type: DataTypes.STRING(100), allowNull: false }
  }, {
    tableName: 'TLCCatalogo_Widgets',
    schema: 'dbo',
    timestamps: false
  });
};

module.exports = { WidgetModel, WidgetlDTO, WidgetSchema };