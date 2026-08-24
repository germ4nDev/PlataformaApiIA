/*
    Author: Juan Valencia
    Refactored by: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization & Joi Validation
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const ScriptSchema = Joi.object({
    codigoScript: Joi.string().max(200).required()
        .messages({ 'any.required': 'El código del script es obligatorio.' }),

    codigoTipoScript: Joi.string().max(200).required()
        .messages({ 'any.required': 'El código del tipo de script es obligatorio.' }),

    codigoAplicacion: Joi.string().max(200).required()
        .messages({ 'any.required': 'El código de la aplicación es obligatorio.' }),

    nombreScript: Joi.string().max(100).required()
        .messages({ 'any.required': 'El nombre del script es obligatorio.' }),

    descripcionScript: Joi.string().max(4000).allow('', null).optional(),

    estadoScript: Joi.boolean().optional().default(true),

    codigoUsuarioCreacion: Joi.string().max(200).required(),
    fechaCreacion: Joi.string().max(100).required(),
    codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
    fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const ScriptDTO = (rawData) => {
    const { error, value } = ScriptSchema.validate(rawData, { abortEarly: false });

    if (error) {
        throw {
            type: 'ValidationError',
            details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
        };
    }

    const fechaActual = new Date().toISOString();

    return {
        codigoScript: value.codigoScript.trim(),
        codigoTipoScript: value.codigoTipoScript.trim(),
        codigoAplicacion: value.codigoAplicacion.trim(),
        nombreScript: value.nombreScript.trim(),
        descripcionScript: value.descripcionScript || '',
        estadoScript: value.estadoScript,

        codigoUsuarioCreacion: value.codigoUsuarioCreacion,
        fechaCreacion: value.fechaCreacion || fechaActual,
        codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
        fechaModificacion: value.fechaModificacion || fechaActual
    };
};

const ScriptModel = (sequelize) => {
    return sequelize.define('PTLScripts', {
        scriptId: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            allowNull: false
        },
        codigoScript: {
            type: DataTypes.STRING(200),
            primaryKey: true,
            allowNull: false
        },
        codigoTipoScript: {
            type: DataTypes.STRING(200),
            allowNull: false
        },
        codigoAplicacion: {
            type: DataTypes.STRING(200),
            allowNull: false
        },
        nombreScript: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        descripcionScript: {
            type: DataTypes.STRING(4000),
            allowNull: true
        },
        estadoScript: {
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
        tableName: 'PTLScripts',
        timestamps: false
    });
};

module.exports = {
    ScriptModel,
    ScriptDTO,
    ScriptSchema
};