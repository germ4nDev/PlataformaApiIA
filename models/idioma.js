/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization & Joi Validation
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const IdiomaSchema = Joi.object({
    codigoIdioma: Joi.string().max(200).required()
        .messages({ 'any.required': 'El código del idioma es obligatorio.' }),

    siglaIdioma: Joi.string().max(10).required()
        .messages({ 'any.required': 'La sigla del idioma (ej: es, en) es obligatoria.' }),

    nombreIdioma: Joi.string().max(100).required()
        .messages({ 'any.required': 'El nombre del idioma es obligatorio.' }),

    flagIdioma: Joi.string().max(100).allow('', null).optional().default('default-flag.png'),

    translateKey: Joi.string().max(100).required()
        .messages({ 'any.required': 'La clave de traducción (translateKey) es obligatoria.' }),

    estadoIdioma: Joi.boolean().optional().default(true),

    codigoUsuarioCreacion: Joi.string().max(200).required(),
    fechaCreacion: Joi.string().max(100).required(),
    codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
    fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const IdiomaDTO = (rawData) => {
    const { error, value } = IdiomaSchema.validate(rawData, { abortEarly: false });

    if (error) {
        throw {
            type: 'ValidationError',
            details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
        };
    }

    const fechaActual = new Date().toISOString();

    return {
        codigoIdioma: value.codigoIdioma.trim(),
        siglaIdioma: value.siglaIdioma.trim().toLowerCase(), // Estandarizamos siglas estrictamente a minúsculas
        nombreIdioma: value.nombreIdioma.trim(),
        flagIdioma: value.flagIdioma || 'default-flag.png',
        translateKey: value.translateKey.trim(),
        estadoIdioma: value.estadoIdioma,

        codigoUsuarioCreacion: value.codigoUsuarioCreacion,
        fechaCreacion: value.fechaCreacion || fechaActual,
        codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
        fechaModificacion: value.fechaModificacion || fechaActual
    };
};

const IdiomaModel = (sequelize) => {
    return sequelize.define('PTLIdiomas', {
        idiomaId: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            allowNull: false
        },
        codigoIdioma: {
            type: DataTypes.STRING(50),
            primaryKey: true,
            allowNull: false
        },
        siglaIdioma: {
            type: DataTypes.STRING(10),
            allowNull: false
        },
        nombreIdioma: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        flagIdioma: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        translateKey: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        estadoIdioma: {
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
        tableName: 'PTLIdiomas',
        timestamps: false
    });
};

module.exports = {
    IdiomaModel,
    IdiomaDTO,
    IdiomaSchema
};