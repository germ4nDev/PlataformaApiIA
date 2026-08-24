/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Multi-tenant Linkage, Typo Correction & Joi Validation
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const UsuarioEmpresaSchema = Joi.object({
  codigoUsuarioEmpresaSC: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código único de la relación Usuario-Empresa es obligatorio.' }),

  codigoUsuarioSC: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código del usuario es obligatorio.' }),

  codigoEmpresaSC: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código de la empresa es obligatorio.' }),

  estadoUsuarioEmpresaSC: Joi.boolean().required(),

  codigoUsuarioCreacion: Joi.string().max(200).allow('', null).optional(),
  fechaCreacion: Joi.string().max(100).allow('', null).optional(),
  codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
  fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const UsuarioEmpresaDTO = (rawData) => {
  const { error, value } = UsuarioEmpresaSchema.validate(rawData, { abortEarly: false });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const fechaActual = new Date().toISOString();

  return {
    codigoUsuarioEmpresaSC: value.codigoUsuarioEmpresaSC.trim(),
    codigoUsuarioSC: value.codigoUsuarioSC.trim(),
    codigoEmpresaSC: value.codigoEmpresaSC.trim(),
    estadoUsuarioEmpresaSC: value.estadoUsuarioEmpresaSC,

    codigoUsuarioCreacion: value.codigoUsuarioCreacion,
    fechaCreacion: value.fechaCreacion || fechaActual,
    codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
    fechaModificacion: value.fechaModificacion || fechaActual
  };
};

const UsuarioEmpresaModel = (sequelize) => {
  return sequelize.define('PTLUsuariosEmpresasSC', {
    usuarioEmpresaSCId: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      allowNull: false
    },
    codigoUsuarioEmpresaSC: {
      type: DataTypes.STRING(200),
      primaryKey: true,
      allowNull: false
    },
    codigoUsuarioSC: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    codigoEmpresaSC: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    estadoUsuarioEmpresaSC: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false
    },
    codigoUsuarioCreacion: {
      type: DataTypes.STRING(200),
      allowNull: true
    },
    fechaCreacion: {
      type: DataTypes.STRING(100),
      allowNull: true
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
    tableName: 'PTLUsuariosEmpresasSC',
    timestamps: false
  });
};

module.exports = {
  UsuarioEmpresaModel,
  UsuarioEmpresaDTO,
  UsuarioEmpresaSchema
};