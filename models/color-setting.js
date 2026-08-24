/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization & Joi Validation
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const ColorSettingsSchema = Joi.object({
    colorNavId: Joi.number().integer().positive().optional(), // Clave primaria numérica opcional para inserts

    codigoColorSetting: Joi.string().max(200).required()
        .messages({ 'any.required': 'El código del colorSetting es obligatorio.' }),

    navbarColor: Joi.string().max(50).required()
        .messages({ 'any.required': 'El color de la barra de navegación es obligatorio.' }),

    textoColor: Joi.string().max(50).required()
        .messages({ 'any.required': 'El color del texto es obligatorio.' }),

    iconosColor: Joi.string().max(50).required()
        .messages({ 'any.required': 'El color de los íconos es obligatorio.' }),

    buttonsHoverColor: Joi.string().max(50).required()
        .messages({ 'any.required': 'El color de hover para los botones es obligatorio.' }),

    estadoColor: Joi.boolean().optional().default(true),

    codigoUsuarioCreacion: Joi.string().max(200).required(),
    fechaCreacion: Joi.string().max(100).required(),
    codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
    fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const ColorSettingsDTO = (rawData) => {
    const { error, value } = ColorSettingsSchema.validate(rawData, { abortEarly: false });

    if (error) {
        throw {
            type: 'ValidationError',
            details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
        };
    }

    const fechaActual = new Date().toISOString();

    return {
        codigoColorSetting: value.codigoColorSetting.trim(),
        navbarColor: value.navbarColor.trim(),
        textoColor: value.textoColor.trim(),
        iconosColor: value.iconosColor.trim(),
        buttonsHoverColor: value.buttonsHoverColor.trim(),
        estadoColor: value.estadoColor,

        codigoUsuarioCreacion: value.codigoUsuarioCreacion,
        fechaCreacion: value.fechaCreacion || fechaActual,
        codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
        fechaModificacion: value.fechaModificacion || fechaActual
    };
};

const ColorSettingsModel = (sequelize) => {
    return sequelize.define('PTLColorSettings', {
        colorNavId: {
            type: DataTypes.INTEGER,
            autoIncrement: true
        },
        codigoColorSetting: {
            type: DataTypes.STRING(50),
            primaryKey: true,
            allowNull: false
        },
        navbarColor: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        textoColor: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        iconosColor: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        buttonsHoverColor: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        estadoColor: {
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
        tableName: 'PTLColorSettings',
        timestamps: false
    });
};

module.exports = {
    ColorSettingsModel,
    ColorSettingsDTO,
    ColorSettingsSchema
};