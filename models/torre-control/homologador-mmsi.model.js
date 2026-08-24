/*
    Author: German Valencia
    Pattern: QPLUS DTO Pattern - Homologación MMSI (Puente AIS-DIMAR)
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

// 1. ESQUEMA DE VALIDACIÓN (JOI)
const HomologacionMmsiSchema = Joi.object({
  mmsi: Joi.alt(Joi.string(), Joi.number()).required(),
  idAviso: Joi.number().integer().required(),
  nombreReferencia: Joi.string().max(150).allow('', null).optional()
});

// 2. DATA TRANSFER OBJECT (DTO)
const HomologacionMmsiDTO = (rawData) => {
  const { error, value } = HomologacionMmsiSchema.validate(rawData, { abortEarly: false, stripUnknown: true });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const fechaISO = new Date().toISOString();

  return {
    mmsi: String(value.mmsi).trim(),
    id_aviso: value.idAviso,
    // Si no envían nombre de referencia, ponemos uno por defecto para saber de dónde salió
    nombre_referencia: value.nombreReferencia ? value.nombreReferencia.trim().toUpperCase() : 'VINCULADO DESDE MAPA',
    fecha_vinculacion: fechaISO
  };
};

// 3. MODELO (SEQUELIZE)
const HomologacionMmsiModel = (sequelize) => {
  return sequelize.define('TCLHomologacionMmsi', {
    mmsi: {
      type: DataTypes.STRING(20),
      primaryKey: true,
      allowNull: false,
      field: 'mmsi'
    },
    id_aviso: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    nombre_referencia: {
      type: DataTypes.STRING(150),
      allowNull: true
    },
    fecha_vinculacion: {
      type: DataTypes.STRING(100), // Mantenemos tu estándar de fechas String de QPLUS
      allowNull: true
    }
  }, {
    tableName: 'TCL_Homologacion_MMSI',
    schema: 'dbo',
    timestamps: false
  });
};

module.exports = { HomologacionMmsiModel, HomologacionMmsiDTO, HomologacionMmsiSchema };