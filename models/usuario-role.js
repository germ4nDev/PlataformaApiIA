const Joi = require('joi');
const { DataTypes } = require('sequelize');

// 1. ESQUEMA JOI CORREGIDO
const UsuarioRoleSchema = Joi.object({
  codigoUsuarioRole: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código único de la asignación de rol es obligatorio.' }),

  codigoUsuarioSC: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código del usuario es obligatorio.' }),

  // 🟢 allow('', null) permite que el frontend envíe strings vacíos sin fallar
  codigoEmpresaSC: Joi.string().max(200).allow('', null).required()
    .messages({ 'any.required': 'El código de la empresa (tenant) es obligatorio.' }),

  codigoRole: Joi.string().max(200).required()
    .messages({ 'any.required': 'El código del rol a asignar es obligatorio.' }),

  estadoUsuarioRole: Joi.boolean().optional().default(true),

  // 🟢 Flexibilizamos la auditoría para que coincida con la BD
  codigoUsuarioCreacion: Joi.string().max(200).allow('', null).optional(),
  fechaCreacion: Joi.string().max(100).allow('', null).optional(),
  codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
  fechaModificacion: Joi.string().max(100).allow('', null).optional()
});


// 2. DTO CORREGIDO
const UsuarioRoleDTO = (rawData) => {
  // 🟢 stripUnknown: true limpia variables como "rolesContexto" antes de validar
  const { error, value } = UsuarioRoleSchema.validate(rawData, { abortEarly: false, stripUnknown: true });

  if (error) {
    throw {
      type: 'ValidationError',
      details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
    };
  }

  const fechaActual = new Date().toISOString();

  return {
    codigoUsuarioRole: value.codigoUsuarioRole.trim(),
    codigoUsuarioSC: value.codigoUsuarioSC.trim(),
    // 🟢 Validación segura (evita crash si es null)
    codigoEmpresaSC: value.codigoEmpresaSC ? value.codigoEmpresaSC.trim() : '',
    codigoRole: value.codigoRole.trim(),
    estadoUsuarioRole: value.estadoUsuarioRole ?? true,

    codigoUsuarioCreacion: value.codigoUsuarioCreacion,
    fechaCreacion: value.fechaCreacion || fechaActual,
    codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
    fechaModificacion: value.fechaModificacion || fechaActual
  };
};


// 3. MODELO SEQUELIZE CORREGIDO
const UsuarioRoleModel = (sequelize) => {
  return sequelize.define('PTLUsuariosRole', {
    usuarioRoleId: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      allowNull: false
    },
    codigoUsuarioRole: {
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
      allowNull: false // Ojo: SQL Server lo exige not null según tu imagen
    },
    codigoRole: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    estadoUsuarioRole: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false
    },
    // 🟢 Actualizado a true para ser idéntico al "Allow Nulls" de tu BD
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
    tableName: 'PTLUsuariosRole',
    timestamps: false
  });
};

module.exports = { UsuarioRoleModel, UsuarioRoleDTO, UsuarioRoleSchema };