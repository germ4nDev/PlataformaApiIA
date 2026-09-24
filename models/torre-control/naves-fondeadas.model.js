/*
    Author: German Valencia
    Pattern: PORTTOS DTO Pattern - Naves Fondeadas (SITMAR)
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const NaveFondeadaSchema = Joi.object({
  capitania: Joi.string().max(100).required(),
  id_aviso: Joi.string().max(100).required(),
  omi: Joi.string().max(100).allow('', null).optional(),
  motonave: Joi.string().max(255).required(),
  bandera: Joi.string().max(100).allow('', null).optional(),
  fecha_fondeo: Joi.date().iso().required(),
  tipo_nave: Joi.string().max(150).allow('', null).optional(),
  eslora: Joi.number().allow(null).optional(),
  calado: Joi.number().allow(null).optional(),
  dwt: Joi.number().allow(null).optional(),
  agencia: Joi.string().max(255).allow('', null).optional(),
  instalacion_portuaria: Joi.string().max(255).allow('', null).optional(),
  pais_procedencia: Joi.string().max(150).allow('', null).optional(),
  puerto_procedencia: Joi.string().max(150).allow('', null).optional()
});

const NaveFondeadaDTO = (rawData, userContext = { codigoUsuario: 'SISTEMA_ETL' }) => {
  const { error, value } = NaveFondeadaSchema.validate(rawData, { abortEarly: false, stripUnknown: true });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  return {
    capitania: value.capitania.trim().toUpperCase(),
    id_aviso: value.id_aviso.trim() ? value.id_aviso.trim() : "0",
    omi: value.omi ? value.omi.trim().toUpperCase() : null,
    motonave: value.motonave.trim().toUpperCase(),
    bandera: value.bandera ? value.bandera.trim().toUpperCase() : null,
    fecha_fondeo: new Date(value.fecha_fondeo).toISOString(),
    tipo_nave: value.tipo_nave ? value.tipo_nave.trim().toUpperCase() : null,
    eslora: value.eslora || null,
    calado: value.calado || null,
    dwt: value.dwt || null,
    agencia: value.agencia ? value.agencia.trim().toUpperCase() : null,
    instalacion_portuaria: value.instalacion_portuaria ? value.instalacion_portuaria.trim().toUpperCase() : null,
    usuario_cargue: userContext.codigoUsuario,
    fecha_cargue: new Date().toISOString()
  };
};

const NaveFondeadaModel = (sequelize) => {
  return sequelize.define('TLCNaves_Fondeadas', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, field: 'id' },
    capitania: { type: DataTypes.STRING(100), allowNull: false },
    id_aviso: { type: DataTypes.STRING(100), allowNull: false },
    omi: { type: DataTypes.STRING(100) },
    motonave: { type: DataTypes.STRING(255), allowNull: false },
    bandera: { type: DataTypes.STRING(100) },
    fecha_fondeo: { type: DataTypes.STRING(100), allowNull: false },
    tipo_nave: { type: DataTypes.STRING(150) },
    eslora: { type: DataTypes.FLOAT },
    calado: { type: DataTypes.FLOAT },
    dwt: { type: DataTypes.FLOAT },
    agencia: { type: DataTypes.STRING(255) },
    instalacion_portuaria: { type: DataTypes.STRING(255) },
    usuario_cargue: { type: DataTypes.STRING(50), allowNull: false },
    fecha_cargue: { type: DataTypes.STRING(100), allowNull: false }
  }, { tableName: 'TLCNaves_Fondeadas', schema: 'dbo', timestamps: false });
};

module.exports = { NaveFondeadaModel, NaveFondeadaDTO, NaveFondeadaSchema };