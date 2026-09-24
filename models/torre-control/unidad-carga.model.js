/*
    Author: German Valencia
    Pattern: PORTTOS DTO Pattern - Unidad de Carga (Inventario y Free Time)
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

// 1. ESQUEMA DE VALIDACIÓN (Joi)
const UnidadCargaSchema = Joi.object({
  codigoUnidad: Joi.string().max(36).optional(),
  codigoOperacion: Joi.string().max(36).required(), // FK al Buque
  codigoNodo_actual: Joi.string().max(36).optional().allow(null, ''), // FK al Patio/Bodega
  identificador: Joi.string().max(100).required(), // Ej: CMAU1234567, VIN, Folio
  tipoCarga: Joi.string().valid('CONTENEDOR', 'VEHICULO', 'BREAK_BULK', 'GRANEL').required(),
  producto: Joi.string().max(100).optional().allow(null, ''),
  pesoTM: Joi.number().precision(2).optional().allow(null),

  estadoOperativo: Joi.string().valid('EN_BUQUE', 'DESCARGANDO', 'EN_PATIO', 'DESPACHADO').required(),
  estadoAduanero: Joi.string().valid('ESPERA_DIAN', 'INSPECCION', 'LEVANTE_AUTORIZADO').default('ESPERA_DIAN'),
  vencimientoFreeTime: Joi.date().iso().optional().allow(null),

  // Capa Geoespacial (Candados IoT)
  latitudIoT: Joi.number().min(-90).max(90).optional().allow(null),
  longitudIoT: Joi.number().min(-180).max(180).optional().allow(null),
  bateriaTracker: Joi.number().min(0).max(100).optional().allow(null),
  fechaUltimaPosicion: Joi.date().iso().optional().allow(null),

  fechaCreacion: Joi.string().optional()
});

// 2. DATA TRANSFER OBJECT (DTO)
const UnidadCargaDTO = (rawData, userContext = { codigoUsuario: 'SISTEMA_ADMIN' }) => {
  const { error, value } = UnidadCargaSchema.validate(rawData, { abortEarly: false, stripUnknown: true });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const fechaActual = new Date().toISOString();
  const usuarioIngesta = userContext.codigoUsuario;

  return {
    codigoUnidad: value.codigoUnidad || uuidv4(),
    codigoOperacion: value.codigoOperacion,
    codigoNodo_actual: value.codigoNodo_actual || null,
    identificador: value.identificador.trim().toUpperCase(),
    tipoCarga: value.tipoCarga,
    producto: value.producto ? value.producto.trim().toUpperCase() : null,
    pesoTM: value.pesoTM || null,

    estadoOperativo: value.estadoOperativo,
    estadoAduanero: value.estadoAduanero,
    vencimientoFreeTime: value.vencimientoFreeTime || null,

    latitudIoT: value.latitudIoT || null,
    longitudIoT: value.longitudIoT || null,
    bateriaTracker: value.bateriaTracker || null,
    fechaUltimaPosicion: value.fechaUltimaPosicion || null,

    codigoUsuarioCreacion: usuarioIngesta,
    fechaCreacion: value.fechaCreacion || fechaActual
  };
};

// 3. MODELO ORM (Sequelize)
const UnidadCargaModel = (sequelize) => {
  return sequelize.define('TLC_Unidad_Carga', {
    codigoUnidad: { type: DataTypes.STRING(36), primaryKey: true, allowNull: false },
    codigoOperacion: { type: DataTypes.STRING(36), allowNull: false },
    codigoNodo_actual: { type: DataTypes.STRING(36), allowNull: true },
    identificador: { type: DataTypes.STRING(100), allowNull: false },
    tipoCarga: { type: DataTypes.STRING(50), allowNull: false },
    producto: { type: DataTypes.STRING(100), allowNull: true },
    pesoTM: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
    estadoOperativo: { type: DataTypes.STRING(50), allowNull: false },
    estadoAduanero: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'ESPERA_DIAN' },
    vencimientoFreeTime: { type: DataTypes.DATE, allowNull: true },

    latitudIoT: { type: DataTypes.DECIMAL(10, 8), allowNull: true },
    longitudIoT: { type: DataTypes.DECIMAL(11, 8), allowNull: true },
    bateriaTracker: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
    fechaUltimaPosicion: { type: DataTypes.DATE, allowNull: true },

    codigoUsuarioCreacion: { type: DataTypes.STRING(200), allowNull: false },
    fechaCreacion: { type: DataTypes.STRING(100), allowNull: false }
  }, {
    tableName: 'TLC_Unidad_Carga',
    schema: 'dbo',
    timestamps: false
  });
};

module.exports = { UnidadCargaModel, UnidadCargaDTO, UnidadCargaSchema };