/*
    Author: German Valencia
    Pattern: QPLUS DTO Pattern - Matriz de Operaciones
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

// 1. EL ESCUDO: Validación de los datos de eficiencia y ratas mínimas
const MatrizOperacionSchema = Joi.object({
  puerto: Joi.string().max(100).default('BUENAVENTURA'),
  terminal: Joi.string().max(100).required(),
  operacion: Joi.string().max(100).required(),
  suboperacion: Joi.string().max(100).allow('', null).optional(),
  tipo_carga: Joi.string().max(100).allow('', null).optional(),
  rata_minima: Joi.string().max(50).allow('', null).optional(),
  unidad: Joi.string().max(50).allow('', null).optional(),
  eficiencia_kpi: Joi.string().max(255).allow('', null).optional(),
  equipos: Joi.string().max(255).allow('', null).optional(),
  infraestructura: Joi.string().max(255).allow('', null).optional(),
  normativa: Joi.string().max(255).allow('', null).optional(),
  observaciones: Joi.string().max(500).allow('', null).optional()
});

// 2. EL ENSAMBLADOR: DTO para sanear la data y aplicar auditoría
const MatrizOperacionDTO = (rawData, userContext) => {
  const { error, value } = MatrizOperacionSchema.validate(rawData, { abortEarly: false, stripUnknown: true });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  return {
    puerto: value.puerto.trim().toUpperCase(),
    terminal: value.terminal.trim().toUpperCase(),
    operacion: value.operacion.trim().toUpperCase(),
    suboperacion: value.suboperacion ? value.suboperacion.trim().toUpperCase() : null,
    tipo_carga: value.tipo_carga ? value.tipo_carga.trim().toUpperCase() : null,
    rata_minima: value.rata_minima ? value.rata_minima.trim() : null,
    unidad: value.unidad ? value.unidad.trim() : null,
    eficiencia_kpi: value.eficiencia_kpi ? value.eficiencia_kpi.trim() : null,
    equipos: value.equipos ? value.equipos.trim() : null,
    infraestructura: value.infraestructura ? value.infraestructura.trim() : null,
    normativa: value.normativa ? value.normativa.trim() : null,
    observaciones: value.observaciones ? value.observaciones.trim() : null,

    // Auditoría
    usuario_cargue: userContext.codigoUsuario,
    fecha_cargue: new Date().toISOString()
  };
};

// 3. EL MAPEO: Definición de Sequelize para T-SQL
const MatrizOperacionModel = (sequelize) => {
  return sequelize.define('TLCMatriz_Operaciones', {
    // Si la tabla no tiene PK autoincremental definida, Sequelize necesita que se la simulemos
    // o uses uuid. Asumiré que no tiene PK explícita en tu script anterior, pero le ponemos un ID virtual.
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      field: 'id'
    },
    puerto: { type: DataTypes.STRING(100) },
    terminal: { type: DataTypes.STRING(100), allowNull: false },
    operacion: { type: DataTypes.STRING(100), allowNull: false },
    suboperacion: { type: DataTypes.STRING(100) },
    tipo_carga: { type: DataTypes.STRING(100) },
    rata_minima: { type: DataTypes.STRING(50) },
    unidad: { type: DataTypes.STRING(50) },
    eficiencia_kpi: { type: DataTypes.STRING(255) },
    equipos: { type: DataTypes.STRING(255) },
    infraestructura: { type: DataTypes.STRING(255) },
    normativa: { type: DataTypes.STRING(255) },
    observaciones: { type: DataTypes.STRING(500) },
    usuario_cargue: { type: DataTypes.STRING(50), allowNull: false },
    fecha_cargue: { type: DataTypes.STRING(100), allowNull: false }
  }, {
    tableName: 'TLCMatriz_Operaciones',
    schema: 'dbo',
    timestamps: false
  });
};

module.exports = { MatrizOperacionModel, MatrizOperacionDTO, MatrizOperacionSchema };