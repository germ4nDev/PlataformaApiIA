/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization & Joi Validation
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const ModuloAPSchema = Joi.object({
    codigoModulo: Joi.string().max(200).required()
        .messages({ 'any.required': 'El código del módulo es obligatorio.' }),

    codigoAplicacion: Joi.string().max(200).required()
        .messages({ 'any.required': 'El código de la aplicación es obligatorio.' }),

    codigoSuite: Joi.string().max(200).required()
        .messages({ 'any.required': 'El código de la suite es obligatorio.' }),

    codigoPadre: Joi.string().max(200).allow('', null).optional().default(''),

    codigoBiblioteca: Joi.string().max(200).allow('', null).optional().default(''),

    nombreModulo: Joi.string().max(100).required()
        .messages({ 'any.required': 'El nombre del módulo es obligatorio.' }),

    precioModulo: Joi.number().precision(2).min(0).optional().default(0.00),

    rutaModulo: Joi.string().max(100).allow('', null).optional().default(''),

    descripcionModulo: Joi.string().max(4000).allow('', null).optional().default(''),

    hijos: Joi.boolean().optional().default(false),

    icon: Joi.string().max(100).allow('', null).optional().default('default-icon'),

    translateKey: Joi.string().max(100).required()
        .messages({ 'any.required': 'La clave de traducción es obligatoria.' }),

    estadoModulo: Joi.boolean().optional().default(true),

    codigoUsuarioCreacion: Joi.string().max(200).required(),
    fechaCreacion: Joi.string().max(100).required(),
    codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
    fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const ModuloAPDTO = (rawData) => {
    const { error, value } = ModuloAPSchema.validate(rawData, { abortEarly: false });

    if (error) {
        throw {
            type: 'ValidationError',
            details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
        };
    }

    const fechaActual = new Date().toISOString();

    return {
        codigoModulo: value.codigoModulo.trim(),
        codigoAplicacion: value.codigoAplicacion.trim(),
        codigoSuite: value.codigoSuite.trim(),
        codigoPadre: value.codigoPadre.trim(),
        codigoBiblioteca: value.codigoBiblioteca.trim(),
        nombreModulo: value.nombreModulo.trim(),
        precioModulo: value.precioModulo,
        rutaModulo: value.rutaModulo.trim(),
        descripcionModulo: value.descripcionModulo.trim(),
        hijos: value.hijos,
        icon: value.icon.trim(),
        translateKey: value.translateKey.trim(),
        estadoModulo: value.estadoModulo,

        codigoUsuarioCreacion: value.codigoUsuarioCreacion,
        fechaCreacion: value.fechaCreacion || fechaActual,
        codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
        fechaModificacion: value.fechaModificacion || fechaActual
    };
};

const ModuloAPModel = (sequelize) => {
    return sequelize.define('PTLModulosAP', {
        moduloId: {
            type: DataTypes.INTEGER,
            autoIncrement: true
        },
        codigoModulo: {
            type: DataTypes.STRING(50),
            primaryKey: true,
            allowNull: false
        },
        codigoAplicacion: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        codigoSuite: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        codigoPadre: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        codigoBiblioteca: {
            type: DataTypes.STRING(50),
            allowNull: true
        },
        nombreModulo: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        precioModulo: {
            type: DataTypes.DECIMAL(18, 2),
            defaultValue: 0,
            allowNull: false
        },
        rutaModulo: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        descripcionModulo: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        hijos: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: false
        },
        icon: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        translateKey: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        estadoModulo: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            allowNull: false
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
        tableName: 'PTLModulosAP',
        timestamps: false
    });
};

module.exports = {
    ModuloAPModel,
    ModuloAPDTO,
    ModuloAPSchema
};