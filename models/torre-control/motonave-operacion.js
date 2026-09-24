/*
    Author: German Valencia
    Pattern: PORTTOS DTO Pattern - Operaciones Motonaves 
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

// 1. EL ESCUDO: Validación estricta de la data operativa entrante
const MotonaveOperacionSchema = Joi.object({
  codigoTerminal: Joi.string().max(50).required(), // Ej: 'TCBUEN', 'SPRBUN'
  nombreMotonave: Joi.string().max(150).required(),
  tipoCarga: Joi.string().max(50).required(), // 'Contenedores', 'Granel Solido', 'Carga General'

  // Variables físicas y de SLA
  caladoMetros: Joi.number().positive().precision(2).required(),
  fechaPrimeraLinea: Joi.date().iso().required(), // Punto de partida para el SLA
  horasLluvia: Joi.number().integer().min(0).default(0),
  cantidadMovida: Joi.number().min(0).precision(2).required() // Toneladas o Movimientos
});

// 2. EL ENSAMBLADOR: Construcción del DTO seguro y aplicación de auditoría
const MotonaveOperacionDTO = (rawData, userContext) => {
  // stripUnknown: true limpia basura; abortEarly: false captura todos los errores
  const { error, value } = MotonaveOperacionSchema.validate(rawData, { abortEarly: false, stripUnknown: true });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  return {
    codigoOperacion: uuidv4(),
    codigoTerminal: value.codigoTerminal.trim(),
    nombreMotonave: value.nombreMotonave.trim().toUpperCase(), // Estandarizamos a mayúsculas
    tipoCarga: value.tipoCarga.trim(),
    caladoMetros: value.caladoMetros,
    fechaPrimeraLinea: value.fechaPrimeraLinea,
    horasLluvia: value.horasLluvia,
    cantidadMovida: value.cantidadMovida,

    // Auditoría automática aplicada con el contexto del middleware (Patrón PORTTOS)
    codigoUsuarioCreacion: userContext.codigoUsuario,
    fechaCreacion: new Date(),
    codigoUsuarioModificacion: userContext.codigoUsuario,
    fechaModificacion: new Date()
  };
};

// 3. EL MAPEO: Definición estricta de Sequelize (T-SQL)
const MotonaveOperacionModel = (sequelize) => {
  return sequelize.define('TCLMotonavesOperacion', {
    codigoOperacion: {
      type: DataTypes.STRING(36), // Exactamente 36 caracteres para UUIDv4
      primaryKey: true,
      allowNull: false
    },
    codigoTerminal: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    nombreMotonave: {
      type: DataTypes.STRING(150),
      allowNull: false
    },
    tipoCarga: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    caladoMetros: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false
    },
    fechaPrimeraLinea: {
      type: DataTypes.DATE,
      allowNull: false
    },
    horasLluvia: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    cantidadMovida: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00
    },

    // Campos de Auditoría PORTTOS
    codigoUsuarioCreacion: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    fechaCreacion: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    codigoUsuarioModificacion: {
      type: DataTypes.STRING(200),
      allowNull: true
    },
    fechaModificacion: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'TCLMotonavesOperacion',
    timestamps: false // Desactivado porque manejamos la auditoría manualmente en el DTO
  });
};

module.exports = {
  MotonaveOperacionModel,
  MotonaveOperacionDTO,
  MotonaveOperacionSchema
};