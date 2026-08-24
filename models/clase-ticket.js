/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization & Joi Validation
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const ClaseTicketSchema = Joi.object({
    codigoClase: Joi.string().max(200).required()
        .messages({ 'any.required': 'El código de la clase de ticket es obligatorio.' }),

    claseTicket: Joi.string().max(100).required()
        .messages({ 'any.required': 'El nombre de la clase de ticket es obligatorio.' }),

    descripcionClase: Joi.string().max(4000).required()
        .messages({ 'any.required': 'La descripción de la clase de ticket es obligatoria.' }),

    estadoClase: Joi.boolean().optional().default(true),

    codigoUsuarioCreacion: Joi.string().max(200).required(),
    fechaCreacion: Joi.string().max(100).required(),
    codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
    fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const ClaseTicketDTO = (rawData) => {
    const { error, value } = ClaseTicketSchema.validate(rawData, { abortEarly: false });

    if (error) {
        throw {
            type: 'ValidationError',
            details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
        };
    }

    const fechaActual = new Date().toISOString();

    return {
        codigoClase: value.codigoClase.trim(),
        claseTicket: value.claseTicket.trim(),
        descripcionClase: value.descripcionClase.trim(),
        estadoClase: value.estadoClase,

        codigoUsuarioCreacion: value.codigoUsuarioCreacion,
        fechaCreacion: value.fechaCreacion || fechaActual,
        codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
        fechaModificacion: value.fechaModificacion || fechaActual
    };
};

const ClaseTicketModel = (sequelize) => {
    return sequelize.define('PTLClasesTicket', {
        claseTicketId: {
            type: DataTypes.INTEGER,
            autoIncrement: true
        },
        codigoClase: {
            type: DataTypes.STRING(50),
            primaryKey: true,
            allowNull: false
        },
        claseTicket: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        descripcionClase: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        estadoClase: {
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
        tableName: 'PTLClasesTicket',
        timestamps: false
    });
};

module.exports = {
    ClaseTicketModel,
    ClaseTicketDTO,
    ClaseTicketSchema
};