/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization & Joi Validation
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const GaleriaSchema = Joi.object({
    codigoGaleria: Joi.string().max(200).required()
        .messages({ 'any.required': 'El código de la galería es obligatorio.' }),

    codigoTipoGaleria: Joi.string().max(200).required()
        .messages({ 'any.required': 'El código del tipo de multimedia es obligatorio.' }),

    nombreGaleria: Joi.string().max(100).required()
        .messages({ 'any.required': 'El nombre del recurso de galería es obligatorio.' }),

    codigoFormato: Joi.string().max(200).required()
        .messages({ 'any.required': 'El código del formato es obligatorio.' }),

    descripcionGaleria: Joi.string().max(4000).allow('', null).optional(),

    imagenGaleria: Joi.string().max(100).allow('', null).optional().default('no-imagen.png'),

    estadoGaleria: Joi.boolean().optional().default(true),

    codigoUsuarioCreacion: Joi.string().max(200).required(),
    fechaCreacion: Joi.string().max(100).required(),
    codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
    fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const GaleriaDTO = (rawData) => {
    const { error, value } = GaleriaSchema.validate(rawData, { abortEarly: false });

    if (error) {
        throw {
            type: 'ValidationError',
            details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
        };
    }

    const fechaActual = new Date().toISOString();

    return {
        codigoGaleria: value.codigoGaleria.trim(),
        codigoTipoGaleria: value.codigoTipoGaleria.trim(),
        nombreGaleria: value.nombreGaleria.trim(),
        codigoFormato: value.codigoFormato.trim(),
        descripcionGaleria: value.descripcionGaleria || '',
        imagenGaleria: value.imagenGaleria || 'no-imagen.png',
        estadoGaleria: value.estadoGaleria,

        codigoUsuarioCreacion: value.codigoUsuarioCreacion,
        fechaCreacion: value.fechaCreacion || fechaActual,
        codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
        fechaModificacion: value.fechaModificacion || fechaActual
    };
};

const GaleriaModel = (sequelize) => {
    return sequelize.define("PTLGaleria", {
        galeriaId: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            allowNull: false
        },
        codigoGaleria: {
            type: DataTypes.STRING(50),
            primaryKey: true,
            allowNull: false
        },
        codigoTipoGaleria: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        nombreGaleria: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        codigoFormato: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        descripcionGaleria: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        imagenGaleria: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        estadoGaleria: {
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
        tableName: "PTLGaleria",
        timestamps: false
    });
};

module.exports = {
    GaleriaModel,
    GaleriaDTO,
    GaleriaSchema
};