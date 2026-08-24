/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization & Joi Validation
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const BibliotecaSchema = Joi.object({
    codigoBiblioteca: Joi.string().max(200).required()
        .messages({ 'any.required': 'El código de la biblioteca es obligatorio.' }),

    codigoAplicacion: Joi.string().max(200).required()
        .messages({ 'any.required': 'El código de la aplicación vinculada es obligatorio.' }),

    nombreBiblioteca: Joi.string().max(100).required()
        .messages({ 'any.required': 'El nombre de la biblioteca es obligatorio.' }),

    descripcionBiblioteca: Joi.string().max(4000).allow('', null).optional(),

    imagenBiblioteca: Joi.string().max(255).allow('', null).optional().default('no-imagen.png'),

    estadoBiblioteca: Joi.boolean().optional().default(true),

    codigoUsuarioCreacion: Joi.string().max(200).required(),
    fechaCreacion: Joi.string().max(100).required(),
    codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
    fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const BibliotecaDTO = (rawData) => {
    const { error, value } = BibliotecaSchema.validate(rawData, { abortEarly: false });

    if (error) {
        throw {
            type: 'ValidationError',
            details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
        };
    }

    const fechaActual = new Date().toISOString();

    return {
        codigoBiblioteca: value.codigoBiblioteca.trim(),
        codigoAplicacion: value.codigoAplicacion.trim(),
        nombreBiblioteca: value.nombreBiblioteca.trim(),
        descripcionBiblioteca: value.descripcionBiblioteca || '',
        imagenBiblioteca: value.imagenBiblioteca || 'no-imagen.png',
        estadoBiblioteca: value.estadoBiblioteca,

        codigoUsuarioCreacion: value.codigoUsuarioCreacion,
        fechaCreacion: value.fechaCreacion || fechaActual,
        codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
        fechaModificacion: value.fechaModificacion || fechaActual
    };
};

const BibliotecaModel = (sequelize) => {
    return sequelize.define('PTLBibliotecas', {
        bibliotecaId: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            allowNull: false
        },
        codigoBiblioteca: {
            type: DataTypes.STRING(50),
            primaryKey: true,
            allowNull: false
        },
        codigoAplicacion: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        nombreBiblioteca: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        descripcionBiblioteca: {
            type: DataTypes.STRING(255),
            allowNull: true
        },

        imagenBiblioteca: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        estadoBiblioteca: {
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
        tableName: 'PTLBibliotecas',
        timestamps: false
    });
};

module.exports = {
    BibliotecaModel,
    BibliotecaDTO,
    BibliotecaSchema
};