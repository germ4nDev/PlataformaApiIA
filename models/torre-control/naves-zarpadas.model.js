/*
    Author: German Valencia
    Pattern: QPLUS DTO Pattern - Naves Zarpadas (SITMAR)
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const NaveZarpadaSchema = Joi.object({
  capitania: Joi.string().max(100).required(),
  id_aviso: Joi.string().max(100).required(),
  omi: Joi.string().max(100).allow('', null).optional(),
  motonave: Joi.string().max(255).required(),
  bandera: Joi.string().max(100).allow('', null).optional(),
  ata: Joi.date().iso().required(),
  atd: Joi.date().iso().required(),
  tipo_nave: Joi.string().max(150).allow('', null).optional(),
  eslora: Joi.number().allow(null).optional(),
  calado: Joi.number().allow(null).optional(),
  dwt: Joi.number().allow(null).optional(),
  agencia: Joi.string().max(255).allow('', null).optional(),
  instalacion_portuaria: Joi.string().max(255).allow('', null).optional(),
  pais_procedencia: Joi.string().max(150).allow('', null).optional(),
  puerto_procedencia: Joi.string().max(150).allow('', null).optional()
});

const NaveZarpadaDTO = (rawData, userContext = { codigoUsuario: 'SISTEMA_ETL' }) => {
  const { error, value } = NaveZarpadaSchema.validate(rawData, { abortEarly: false, stripUnknown: true });

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
    ata: new Date(value.ata).toISOString(),
    atd: new Date(value.atd).toISOString(),
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

const NaveZarpadaModel = (sequelize) => {
  return sequelize.define('TLCNaves_Zarpadas', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, field: 'id' },
    capitania: { type: DataTypes.STRING(100), allowNull: false },
    id_aviso: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    omi: { type: DataTypes.STRING(100) },
    motonave: { type: DataTypes.STRING(255), allowNull: false },
    bandera: { type: DataTypes.STRING(100) },
    ata: { type: DataTypes.STRING(100), allowNull: false },
    atd: { type: DataTypes.STRING(100), allowNull: false },
    tipo_nave: { type: DataTypes.STRING(150) },
    eslora: { type: DataTypes.FLOAT },
    calado: { type: DataTypes.FLOAT },
    dwt: { type: DataTypes.FLOAT },
    agencia: { type: DataTypes.STRING(255) },
    instalacion_portuaria: { type: DataTypes.STRING(255) },
    usuario_cargue: { type: DataTypes.STRING(50), allowNull: false },
    fecha_cargue: { type: DataTypes.STRING(100), allowNull: false }
  }, { tableName: 'TLCNaves_Zarpadas', schema: 'dbo', timestamps: false });
};

module.exports = { NaveZarpadaModel, NaveZarpadaDTO, NaveZarpadaSchema };