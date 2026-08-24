/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization & Joi Validation
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const TipoScriptSchema = Joi.object({
    codigoTipoScript: Joi.string().max(200).required()
        .messages({ 'any.required': 'El código único del tipo de script es obligatorio.' }),

    nombreTipo: Joi.string().max(100).required()
        .messages({ 'any.required': 'El nombre descriptivo del tipo de script es obligatorio.' }),

    descripcionTipo: Joi.string().max(4000).allow('', null).optional(),

    estadoTipo: Joi.boolean().optional().default(true),

    codigoUsuarioCreacion: Joi.string().max(200).required(),
    fechaCreacion: Joi.string().max(100).required(),
    codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
    fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const TipoScriptDTO = (rawData) => {
    const { error, value } = TipoScriptSchema.validate(rawData, { abortEarly: false });

    if (error) {
        throw {
            type: 'ValidationError',
            details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
        };
    }

    const fechaActual = new Date().toISOString();

    return {
        codigoTipoScript: value.codigoTipoScript.trim(),
        nombreTipo: value.nombreTipo.trim(),
        descripcionTipo: value.descripcionTipo ? value.descripcionTipo.trim() : '',
        estadoTipo: value.estadoTipo,

        codigoUsuarioCreacion: value.codigoUsuarioCreacion,
        fechaCreacion: value.fechaCreacion || fechaActual,
        codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
        fechaModificacion: value.fechaModificacion || fechaActual
    };
};

const TipoScriptModel = (sequelize) => {
    return sequelize.define('PTLTiposScripts', {
        tipoScriptId: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            allowNull: false
        },
        codigoTipoScript: {
            type: DataTypes.STRING(50),
            primaryKey: true,
            allowNull: false
        },
        nombreTipo: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        descripcionTipo: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        estadoTipo: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
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
            allowNull: false
        },
        fechaModificacion: {
            type: DataTypes.STRING(100),
            allowNull: false
        }
    }, {
        tableName: 'PTLTiposScripts',
        timestamps: false
    });
};

module.exports = {
    TipoScriptModel,
    TipoScriptDTO,
    TipoScriptSchema
};