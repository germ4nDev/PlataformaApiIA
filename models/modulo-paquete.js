/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization, Joi Validation & SQL Server precision
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const ModuloPQSchema = Joi.object({
    codigoModuloPQ: Joi.string().max(200).required()
        .messages({ 'any.required': 'El código de la relación Módulo-Paquete es obligatorio.' }),

    codigoAplicacion: Joi.string().max(200).required()
        .messages({ 'any.required': 'El código de la aplicación es obligatorio.' }),

    codigoSuite: Joi.string().max(200).required()
        .messages({ 'any.required': 'El código de la suite es obligatorio.' }),

    codigoModulo: Joi.string().max(200).required()
        .messages({ 'any.required': 'El código del módulo es obligatorio.' }),

    codigoPaquete: Joi.string().max(200).required()
        .messages({ 'any.required': 'El código del paquete vinculado es obligatorio.' }),

    estadoModuloPQ: Joi.boolean().optional().default(true),

    codigoUsuarioCreacion: Joi.string().max(200).required(),
    fechaCreacion: Joi.string().max(100).required(),
    codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
    fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const ModuloPQDTO = (rawData) => {
    const { error, value } = ModuloPQSchema.validate(rawData, { abortEarly: false });

    if (error) {
        throw {
            type: 'ValidationError',
            details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
        };
    }

    const fechaActual = new Date().toISOString();

    return {
        codigoModuloPQ: value.codigoModuloPQ.trim(),
        codigoAplicacion: value.codigoAplicacion.trim(),
        codigoSuite: value.codigoSuite.trim(),
        codigoModulo: value.codigoModulo.trim(),
        codigoPaquete: value.codigoPaquete.trim(),
        estadoModuloPQ: value.estadoModuloPQ,

        codigoUsuarioCreacion: value.codigoUsuarioCreacion,
        fechaCreacion: value.fechaCreacion || fechaActual,
        codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
        fechaModificacion: value.fechaModificacion || fechaActual
    };
};

const ModuloPQModel = (sequelize) => {
    return sequelize.define('PTLModulosPQ', {
        moduloPQId: {
            type: DataTypes.INTEGER,
            autoIncrement: true
        },
        codigoModuloPQ: {
            type: DataTypes.STRING(200),
            primaryKey: true,
            allowNull: false
        },
        codigoAplicacion: {
            type: DataTypes.STRING(200),
            allowNull: false
        },
        codigoSuite: {
            type: DataTypes.STRING(200),
            allowNull: false
        },
        codigoModulo: {
            type: DataTypes.STRING(200),
            allowNull: false
        },
        codigoPaquete: {
            type: DataTypes.STRING(200),
            allowNull: false
        },
        estadoModuloPQ: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
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
        tableName: 'PTLModulosPQ',
        timestamps: false
    });
};

module.exports = {
    ModuloPQModel,
    ModuloPQDTO,
    ModuloPQSchema
};