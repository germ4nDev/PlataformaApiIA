/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization & Joi Validation
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const SliderInicioSchema = Joi.object({
    codigoSlider: Joi.string().max(200).required()
        .messages({ 'any.required': 'El código del slider es obligatorio.' }),

    nombreSlider: Joi.string().max(100).required()
        .messages({ 'any.required': 'El nombre descriptivo del slider es obligatorio.' }),

    urlSlider: Joi.string().max(200).allow('', null).optional().default('no-imagen.png'),

    descripcionSlider: Joi.string().max(4000).allow('').required()
        .messages({ 'any.required': 'La descripción del slider es obligatoria.' }),

    estadoSlider: Joi.boolean().optional().default(true),

    codigoUsuarioCreacion: Joi.string().max(200).required(),
    fechaCreacion: Joi.string().max(100).required(),
    codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
    fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const SliderInicioDTO = (rawData) => {
    const { error, value } = SliderInicioSchema.validate(rawData, { abortEarly: false });

    if (error) {
        throw {
            type: 'ValidationError',
            details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
        };
    }

    const fechaActual = new Date().toISOString();

    return {
        codigoSlider: value.codigoSlider.trim(),
        nombreSlider: value.nombreSlider.trim(),
        urlSlider: value.urlSlider.trim() || 'no-imagen.png',
        descripcionSlider: value.descripcionSlider.trim(),
        estadoSlider: value.estadoSlider,

        codigoUsuarioCreacion: value.codigoUsuarioCreacion,
        fechaCreacion: value.fechaCreacion || fechaActual,
        codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
        fechaModificacion: value.fechaModificacion || fechaActual
    };
};

const SliderInicioModel = (sequelize) => {
    return sequelize.define('PTLSliderInicio', {
        sliderId: {
            type: DataTypes.INTEGER,
            autoIncrement: true
        },
        codigoSlider: {
            type: DataTypes.STRING(200),
            primaryKey: true,
            allowNull: false
        },
        nombreSlider: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        urlSlider: {
            type: DataTypes.STRING(200),
            allowNull: false,
            defaultValue: 'no-imagen.png'
        },
        descripcionSlider: {
            type: DataTypes.STRING(4000),
            allowNull: false
        },
        estadoSlider: {
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
        tableName: 'PTLSliderInicio',
        timestamps: false
    });
};

module.exports = {
    SliderInicioModel,
    SliderInicioDTO,
    SliderInicioSchema
};