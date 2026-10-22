/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization & Joi Validation
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

// 1. ESQUEMA ALINEADO EXACTAMENTE CON LA DB
const AplicacionSchema = Joi.object({
    aplicacionId: Joi.number().integer().optional(), // 🟢 Se agrega para permitir lectura/actualización

    codigoAplicacion: Joi.string().max(200).required()
        .messages({ 'any.required': 'El código de la aplicación es obligatorio.' }),

    nombreAplicacion: Joi.string().max(100).required()
        .messages({ 'any.required': 'El nombre de la aplicación es obligatorio.' }),

    descripcionAplicacion: Joi.string().max(4000).allow('', null).optional(),

    estadoAplicacion: Joi.boolean().optional().default(true),

    translateKey: Joi.string().max(200).required() // 🟢 Corregido a 200 según DB
        .messages({ 'any.required': 'La clave de traducción (translateKey) es obligatoria.' }),

    plantillaBD: Joi.string().max(100).allow('', null).optional().default('plataformaBD'),
    prefijoBD: Joi.string().max(10).allow('', null).optional().default('ptl'),

    imagenInicio: Joi.string().max(100).allow('', null).optional().default('no-imagen.png'),
    imagenUI: Joi.string().max(100).allow('', null).optional().default('no-imagen.png'),
    imagenUIB: Joi.string().max(100).allow('', null).optional().default('no-imagen.png'),
    imagenLogo: Joi.string().max(100).allow('', null).optional().default('no-imagen.png'),
    imagenLogoB: Joi.string().max(100).allow('', null).optional().default('no-imagen.png'),
    imagenIcono: Joi.string().max(100).allow('', null).optional().default('no-imagen.png'),

    codigoUsuarioCreacion: Joi.string().max(200).allow('', null).optional(),
    fechaCreacion: Joi.string().max(100).allow('', null).optional(),
    codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
    fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

// 2. DTO SEGURO QUE PRESERVA EL ID SI EXISTE
const AplicacionDTO = (rawData) => {
    // stripUnknown: true es clave si el ORM inyecta metadatos internos (timestamps, symbols)
    const { error, value } = AplicacionSchema.validate(rawData, { abortEarly: false, stripUnknown: true });

    if (error) {
        throw {
            type: 'ValidationError',
            details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
        };
    }

    const fechaActual = new Date().toISOString();

    const dto = {
        codigoAplicacion: value.codigoAplicacion.trim(),
        nombreAplicacion: value.nombreAplicacion.trim(),
        descripcionAplicacion: value.descripcionAplicacion || '',
        estadoAplicacion: value.estadoAplicacion,
        translateKey: value.translateKey.trim(),
        plantillaBD: value.plantillaBD ? value.plantillaBD.trim() : 'plataformaBD',
        prefijoBD: value.prefijoBD ? value.prefijoBD.trim() : 'ptl',
        imagenInicio: value.imagenInicio || 'no-imagen.png',
        imagenUI: value.imagenUI || 'no-imagen.png',
        imagenUIB: value.imagenUIB || 'no-imagen.png',
        imagenLogo: value.imagenLogo || 'no-imagen.png',
        imagenLogoB: value.imagenLogoB || 'no-imagen.png',
        imagenIcono: value.imagenIcono || 'no-imagen.png',

        codigoUsuarioCreacion: value.codigoUsuarioCreacion,
        fechaCreacion: value.fechaCreacion || fechaActual,
        codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
        fechaModificacion: value.fechaModificacion || fechaActual
    };

    // Si es un Update, mantenemos el ID. Si es un Create nuevo, lo omitimos.
    if (value.aplicacionId) {
        dto.aplicacionId = value.aplicacionId;
    }

    return dto;
};

// 3. MODELO SEQUELIZE IDÉNTICO AL SCHEMA DB
const AplicacionModel = (sequelize) => {
    return sequelize.define('PTLAplicaciones', {
        aplicacionId: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            // 🟢 Nota: No le pongas primaryKey: true aquí si 'codigoAplicacion' es tu verdadera PK
            // Si la PK en SQL Server es aplicacionId, ponla aquí. 
            // Si ambas conforman una PK compuesta o codigoAplicacion es la real, mantenlo.
            allowNull: false
        },
        codigoAplicacion: {
            type: DataTypes.STRING(200), // 🟢 Corregido a 200 según DB
            primaryKey: true,
            allowNull: false
        },
        nombreAplicacion: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        descripcionAplicacion: {
            type: DataTypes.STRING(4000),
            allowNull: true
        },
        translateKey: {
            type: DataTypes.STRING(200), // 🟢 Corregido a 200 según DB
            allowNull: false
        },
        plantillaBD: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        prefijoBD: {
            type: DataTypes.STRING(10),
            allowNull: true
        },
        imagenInicio: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        imagenUI: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        imagenUIB: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        imagenLogo: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        imagenLogoB: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        imagenIcono: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        estadoAplicacion: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        },
        codigoUsuarioCreacion: {
            type: DataTypes.STRING(200),
            allowNull: true // 🟢 Corregido a true según DB
        },
        fechaCreacion: {
            type: DataTypes.STRING(100),
            allowNull: true // 🟢 Corregido a true según DB
        },
        codigoUsuarioModificacion: {
            type: DataTypes.STRING(200),
            allowNull: true // 🟢 Corregido a true según DB
        },
        fechaModificacion: {
            type: DataTypes.STRING(100),
            allowNull: true // 🟢 Corregido a true según DB
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