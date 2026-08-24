/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization & Joi Validation
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const FormatoGaleriaSchema = Joi.object({
    codigoFormato: Joi.string().max(200).required()
        .messages({ 'any.required': 'El código del formato (extensión) es obligatorio.' }),

    codigoTipoGaleria: Joi.string().max(200).required()
        .messages({ 'any.required': 'El código del tipo de multimedia es obligatorio.' }),

    nombreFormato: Joi.string().max(100).required()
        .messages({ 'any.required': 'El nombre del formato es obligatorio.' }),

    descripcionFormato: Joi.string().max(4000).allow('', null).optional(),

    estadoFormato: Joi.boolean().optional().default(true),

    codigoUsuarioCreacion: Joi.string().max(200).required(),
    fechaCreacion: Joi.string().max(100).required(),
    codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
    fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const FormatoGaleriaDTO = (rawData) => {
    const { error, value } = FormatoGaleriaSchema.validate(rawData, { abortEarly: false });

    if (error) {
        throw {
            type: 'ValidationError',
            details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
        };
    }

    const fechaActual = new Date().toISOString();

    return {
        codigoFormato: value.codigoFormato.trim().toLowerCase(), // Estandarización a minúsculas (.mp4, .png)
        codigoTipoGaleria: value.codigoTipoGaleria.trim(),
        nombreFormato: value.nombreFormato.trim(),
        descripcionFormato: value.descripcionFormato || '',
        estadoFormato: value.estadoFormato,

        codigoUsuarioCreacion: value.codigoUsuarioCreacion,
        fechaCreacion: value.fechaCreacion || fechaActual,
        codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
        fechaModificacion: value.fechaModificacion || fechaActual
    };
};

const FormatoGaleriaModel = (sequelize) => {
    return sequelize.define("PTLFormatosGaleria", {
        formatoId: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            allowNull: false
        },
        codigoFormato: {
            type: DataTypes.STRING(50),
            primaryKey: true,
            allowNull: false
        },
        codigoTipoGaleria: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        nombreFormato: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        descripcionFormato: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        estadoFormato: {
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
        tableName: "PTLFormatosGaleria",
        timestamps: false
    });
};

module.exports = {
    FormatoGaleriaModel,
    FormatoGaleriaDTO,
    FormatoGaleriaSchema
};