/*
    Author: German Valencia
    Pattern: QPLUS DTO Pattern - Reportes Operativos
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

// 1. EL ESCUDO: Validación estricta
const ReporteOperativoSchema = Joi.object({
  puerto: Joi.string().max(100).required(),
  titulo: Joi.string().max(150).required(),
  fecha_evento: Joi.string().required(),
  descripcion: Joi.string().allow('', null).optional(),
  tipo_color: Joi.string().max(20).valid('success', 'primary', 'warning', 'danger').optional(),
  fecha_registro: Joi.string().required()
});

// 2. EL ENSAMBLADOR: DTO seguro
const ReporteOperativoDTO = (rawData, userContext) => {
  const { error, value } = ReporteOperativoSchema.validate(rawData, { abortEarly: false, stripUnknown: true });

  if (error) {
    throw { type: 'ValidationError', details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message })) };
  }

  return {
    puerto: value.puerto.trim().toUpperCase(),
    titulo: value.titulo.trim(),
    fecha_evento: value.fecha_evento,
    descripcion: value.descripcion || null,
    tipo_color: value.tipo_color || 'primary',
    fecha_registro: value.fecha_registro,
    // Auditoría QPLUS
    usuario_registro: userContext.codigoUsuario
  };
};

// 3. EL MAPEO: Sequelize -> SQL Server
const ReporteOperativoModel = (sequelize) => {
  return sequelize.define('TLCReportesOperativos', {
    id_reporte: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, field: 'id_reporte' },
    puerto: { type: DataTypes.STRING(100), allowNull: false, field: 'puerto' },
    titulo: { type: DataTypes.STRING(150), allowNull: false, field: 'titulo' },
    fecha_evento: { type: DataTypes.STRING(100), allowNull: false, field: 'fecha_evento' },
    descripcion: { type: DataTypes.TEXT, allowNull: true, field: 'descripcion' },
    tipo_color: { type: DataTypes.STRING(20), allowNull: true, field: 'tipo_color' },
    fecha_registro: { type: DataTypes.STRING(100), allowNull: false, field: 'fecha_registro' }
  }, {
    tableName: 'TLCReportesOperativos',
    schema: 'dbo',
    timestamps: false
  });
};

module.exports = { ReporteOperativoModel, ReporteOperativoDTO, ReporteOperativoSchema };