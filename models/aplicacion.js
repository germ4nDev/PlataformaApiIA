/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization & Joi Validation
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const AplicacionSchema = Joi.object({
    codigoAplicacion: Joi.string().max(200).required()
        .messages({ 'any.required': 'El código de la aplicación es obligatorio.' }),

    nombreAplicacion: Joi.string().max(100).required()
        .messages({ 'any.required': 'El nombre de la aplicación es obligatorio.' }),

    descripcionAplicacion: Joi.string().max(4000).allow('', null).optional(),

    estadoAplicacion: Joi.boolean().optional().default(true),

    translateKey: Joi.string().max(100).required()
        .messages({ 'any.required': 'La clave de traducción (translateKey) es obligatoria.' }),

    plantillaBD: Joi.string().max(100).allow('', null).optional().default('plataformaBD'),
    prefijoBD: Joi.string().max(10).allow('', null).optional().default('ptl'),

    imagenInicio: Joi.string().max(100).allow('', null).optional().default('no-imagen.png'),
    imagenUI: Joi.string().max(100).allow('', null).optional().default('no-imagen.png'),

    codigoUsuarioCreacion: Joi.string().max(200).required(),
    fechaCreacion: Joi.string().max(100).required(),
    codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
    fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const AplicacionDTO = (rawData) => {
    const { error, value } = AplicacionSchema.validate(rawData, { abortEarly: false });

    if (error) {
        throw {
            type: 'ValidationError',
            details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
        };
    }

    const fechaActual = new Date().toISOString();

    return {
        codigoAplicacion: value.codigoAplicacion.trim(),
        nombreAplicacion: value.nombreAplicacion.trim(),
        descripcionAplicacion: value.descripcionAplicacion || '',
        estadoAplicacion: value.estadoAplicacion,
        translateKey: value.translateKey.trim(),
        plantillaBD: value.plantillaBD.trim(),
        prefijoBD: value.prefijoBD.trim(),
        imagenInicio: value.imagenInicio || 'no-imagen.png',
        imagenUI: value.imagenInicio || 'no-imagen.png',

        codigoUsuarioCreacion: value.codigoUsuarioCreacion,
        fechaCreacion: value.fechaCreacion || fechaActual,
        codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
        fechaModificacion: value.fechaModificacion || fechaActual
    };
};

const AplicacionModel = (sequelize) => {
    return sequelize.define('PTLAplicaciones', {
        aplicacionId: {
            type: DataTypes.INTEGER,
            autoIncrement: true
        },
        codigoAplicacion: {
            type: DataTypes.STRING(50),
            primaryKey: true,
            allowNull: false
        },
        nombreAplicacion: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        descripcionAplicacion: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        estadoAplicacion: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        },
        translateKey: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        imagenInicio: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        imagenUI: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        plantillaBD: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        prefijoBD: {
            type: DataTypes.STRING(10),
            allowNull: true
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
        tableName: 'PTLAplicaciones',
        timestamps: false
    });
};

module.exports = {
    AplicacionModel,
    AplicacionDTO,
    AplicacionSchema
};