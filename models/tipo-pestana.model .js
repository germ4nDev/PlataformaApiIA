/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization, Joi Validation
    Updated for: Metadata-Driven Layout Engine (Tab Strategies)
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

// 1. ESQUEMA DE VALIDACIÓN (JOI)
const TipoPestanaSchema = Joi.object({
    codigoTipo: Joi.string().max(200).required(),
    estrategia: Joi.string().valid(
        'CASCADA_DINAMICA',
        'ESTATICO_ANALITICO',
        'FLUJO_PROCESO',
        'LIENZO_ESPACIAL'
    ).required(),
    descripcion: Joi.string().max(500).allow('', null).optional(),
    estado: Joi.boolean().default(true),

    // Campos de auditoría
    codigoUsuario: Joi.string().max(200).required(),
    codigoUsuarioCreacion: Joi.string().max(200).allow('', null).optional(),
    fechaCreacion: Joi.string().max(100).allow('', null).optional(),
    codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
    fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

// 2. DATA TRANSFER OBJECT (DTO)
const TipoPestanaDTO = (rawData) => {
    const { error, value } = TiposPestanaSchema.validate(rawData, { abortEarly: false, stripUnknown: true });

    if (error) {
        throw {
            type: 'ValidationError',
            details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
        };
    }

    const fechaActual = new Date().toISOString();

    return {
        codigoTipo: value.codigoTipo.trim(),
        estrategia: value.estrategia,
        descripcion: value.descripcion ? value.descripcion.trim() : null,
        estado: value.estado,
        codigoUsuarioCreacion: value.codigoUsuarioCreacion || value.codigoUsuario.trim(),
        fechaCreacion: value.fechaCreacion || fechaActual,
        codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuario.trim(),
        fechaModificacion: value.fechaModificacion || fechaActual
    };
};

// 3. MODELO SEQUELIZE
const TipoPestanaModel = (sequelize) => {
    return sequelize.define('PTLTiposPestana', {
        // tipoId: {
        //     type: DataTypes.INTEGER,
        //     autoIncrement: true,
        //     allowNull: false
        // },
        codigoTipo: {
            type: DataTypes.STRING(200),
            primaryKey: true,
            allowNull: false
        },
        estrategia: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        descripcion: {
            type: DataTypes.STRING(500),
            allowNull: true
        },
        estado: {
            type: DataTypes.BOOLEAN,
            allowNull: false
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
        tableName: 'PTLTiposPestana',
        timestamps: false
    });
};

module.exports = {
    TipoPestanaModel,
    TipoPestanaDTO,
    TipoPestanaSchema
};