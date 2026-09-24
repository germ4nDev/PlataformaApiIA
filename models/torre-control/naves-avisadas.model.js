/*
    Author: German Valencia
    Pattern: PORTTOS DTO Pattern - Naves Avisadas (SITMAR)
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

// 1. EL ESCUDO: Validación de los datos extraídos de la DIMAR
const NaveAvisadaSchema = Joi.object({
  capitania: Joi.string().max(100).required(),
  id_aviso: Joi.string().max(100).required(), // Clave única que da SITMAR
  omi: Joi.string().max(100).allow('', null).optional(),
  motonave: Joi.string().max(255).required(),
  bandera: Joi.string().max(100).allow('', null).optional(),
  eta: Joi.date().iso().required(), // Validamos que sea una fecha válida
  tipo_nave: Joi.string().max(150).allow('', null).optional(),
  eslora: Joi.number().allow(null).optional(),
  calado: Joi.number().allow(null).optional(),
  dwt: Joi.number().allow(null).optional(),
  agencia: Joi.string().max(255).allow('', null).optional(),
  instalacion_portuaria: Joi.string().max(255).allow('', null).optional(),
  pais_procedencia: Joi.string().max(150).allow('', null).optional(),
  puerto_procedencia: Joi.string().max(150).allow('', null).optional()
});

// 2. EL ENSAMBLADOR: DTO para sanear la data y aplicar auditoría
const NaveAvisadaDTO = (rawData, userContext = { codigoUsuario: 'SISTEMA_ETL' }) => {
  const { error, value } = NaveAvisadaSchema.validate(rawData, { abortEarly: false, stripUnknown: true });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  return {
    capitania: value.capitania.trim().toUpperCase(),
    id_aviso: value.id_aviso.trim(),
    omi: value.omi ? value.omi.trim().toUpperCase() : null,
    motonave: value.motonave.trim().toUpperCase(),
    bandera: value.bandera ? value.bandera.trim().toUpperCase() : null,
    eta: new Date(value.eta).toISOString(), // Estandarizamos el ETA
    tipo_nave: value.tipo_nave ? value.tipo_nave.trim().toUpperCase() : null,
    // Si vienen en 0 o NaN desde el scraper, los dejamos en null para mantener la BD limpia
    eslora: value.eslora || null,
    calado: value.calado || null,
    dwt: value.dwt || null,
    agencia: value.agencia ? value.agencia.trim().toUpperCase() : null,
    instalacion_portuaria: value.instalacion_portuaria ? value.instalacion_portuaria.trim().toUpperCase() : null,

    // Auditoría
    usuario_cargue: userContext.codigoUsuario,
    fecha_cargue: new Date().toISOString()
  };
};

// 3. EL MAPEO: Definición de Sequelize para T-SQL
const NaveAvisadaModel = (sequelize) => {
  return sequelize.define('TLCNaves_Avisadas', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      field: 'id'
    },
    capitania: { type: DataTypes.STRING(100), allowNull: false },
    id_aviso: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true // Vital para hacer upsert sin duplicar naves
    },
    omi: { type: DataTypes.STRING(100) },
    motonave: { type: DataTypes.STRING(255), allowNull: false },
    bandera: { type: DataTypes.STRING(100) },
    eta: { type: DataTypes.STRING(100), allowNull: false }, // Se almacena como string ISO según tu estándar
    tipo_nave: { type: DataTypes.STRING(150) },
    eslora: { type: DataTypes.FLOAT },
    calado: { type: DataTypes.FLOAT },
    dwt: { type: DataTypes.FLOAT },
    agencia: { type: DataTypes.STRING(255) },
    instalacion_portuaria: { type: DataTypes.STRING(255) },

    // Auditoría
    usuario_cargue: { type: DataTypes.STRING(50), allowNull: false },
    fecha_cargue: { type: DataTypes.STRING(100), allowNull: false }
  }, {
    tableName: 'TLCNaves_Avisadas',
    schema: 'dbo',
    timestamps: false // Lo mantengo en false porque manejas fecha_cargue manualmente
  });
};

module.exports = { NaveAvisadaModel, NaveAvisadaDTO, NaveAvisadaSchema };