/*
    Author: German Valencia
    Pattern: PORTTOS DTO Pattern - Control de Citas y Virtual Gate
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid'); // Recomendado para el ID único de la cita

const CitaGateSchema = Joi.object({
  idCita: Joi.string().max(36).optional(), // Se autogenera en el DTO si no viene
  placa: Joi.string().min(5).max(10).required(),
  transportador: Joi.string().max(150).required(),
  tipoCarga: Joi.string().valid('Contenedor', 'Granel agric.', 'Granel mineral', 'Carga suelta', 'Vehiculo Ro-Ro').required(),
  operacion: Joi.string().max(100).required(),
  terminal: Joi.string().valid('SPRBUN', 'TCBUEN', 'AGUADULCE').required(),
  fechaHoraCita: Joi.string().max(100).required(), // Formato ISO o 'HH:mm' según convención
  ubicacion: Joi.string().max(150).required(),
  estado: Joi.string().valid('VALIDADO', 'EN OPERACIÓN', 'DOC. FALTANTE', 'EN RUTA', 'RETENIDO', 'EN COLA').required(),

  // Campos para lógica de tiempos y métricas
  tiempoEsperaMinutos: Joi.number().integer().min(0).default(0).optional(),

  // Auditoría opcional en la entrada
  fechaCreacion: Joi.string().optional(),
  fechaModificacion: Joi.string().optional()
});

const CitaGateDTO = (rawData, userContext = { codigoUsuario: 'CRON_GATE_SYS' }) => {
  const { error, value } = CitaGateSchema.validate(rawData, { abortEarly: false, stripUnknown: true });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const fechaActual = new Date().toISOString();
  const usuarioIngesta = userContext.codigoUsuario;

  return {
    id_cita: value.idCita || uuidv4(),
    placa: value.placa.trim().toUpperCase(),
    transportador: value.transportador.trim().toUpperCase(),
    tipo_carga: value.tipoCarga,
    operacion: value.operacion.trim(),
    terminal: value.terminal,
    fecha_hora_cita: value.fechaHoraCita,
    ubicacion: value.ubicacion.trim(),
    estado: value.estado,
    tiempo_espera_minutos: value.tiempoEsperaMinutos,

    codigoUsuarioCreacion: usuarioIngesta,
    fechaCreacion: value.fechaCreacion || fechaActual,
    codigoUsuarioModificacion: usuarioIngesta,
    fechaModificacion: value.fechaModificacion || fechaActual
  };
};

const CitaGateModel = (sequelize) => {
  return sequelize.define('TCLCitasGate', {
    id_cita: {
      type: DataTypes.STRING(36),
      primaryKey: true,
      allowNull: false
    },
    placa: {
      type: DataTypes.STRING(10),
      allowNull: false
    },
    transportador: {
      type: DataTypes.STRING(150),
      allowNull: false
    },
    tipo_carga: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    operacion: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    terminal: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    fecha_hora_cita: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    ubicacion: {
      type: DataTypes.STRING(150),
      allowNull: false
    },
    estado: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    tiempo_espera_minutos: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    codigoUsuarioCreacion: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    fechaCreacion: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    codigoUsuarioModificacion: {
      type: DataTypes.STRING(200),
      allowNull: true
    },
    fechaModificacion: {
      type: DataTypes.STRING(100),
      allowNull: true
    }
  }, {
    tableName: 'TCLCitasGate',
    schema: 'dbo',
    timestamps: false
  });
};

module.exports = { CitaGateModel, CitaGateDTO, CitaGateSchema };