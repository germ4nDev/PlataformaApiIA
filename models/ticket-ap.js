/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization & Joi Validation
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const TicketAPSchema = Joi.object({
    codigoTicket: Joi.string().max(200).required()
        .messages({ 'any.required': 'El código único del ticket es obligatorio.' }),

    codigoAplicacion: Joi.string().max(200).required()
        .messages({ 'any.required': 'El código de la aplicación es obligatorio.' }),

    codigoSuite: Joi.string().max(200).required()
        .messages({ 'any.required': 'El código de la suite es obligatorio.' }),

    codigoModulo: Joi.string().max(200).required()
        .messages({ 'any.required': 'El código del módulo es obligatorio.' }),

    codigoClase: Joi.string().max(200).required()
        .messages({ 'any.required': 'El código de la clase del ticket es obligatorio.' }),

    fechaTicket: Joi.string().max(100).optional(new Date().toISOString()),

    nombreTicket: Joi.string().max(100).required()
        .messages({ 'any.required': 'El asunto o nombre del ticket es obligatorio.' }),

    codigoUsuarioSender: Joi.string().max(200).required()
        .messages({ 'any.required': 'El usuario que emite el ticket es obligatorio.' }),

    codigoUsuarioAsignado: Joi.string().max(200).allow('', null).optional().default('SIN_ASIGNAR'),

    fechaAsignacion: Joi.string().max(100).allow('', null).optional(new Date().toISOString()),

    prioridad: Joi.string().max(50).optional().default('NORMAL'),

    colorPrioridad: Joi.string().max(50).optional().default('#808080'),

    descripcionTicket: Joi.string().max(4000).required()
        .messages({ 'any.required': 'La descripción detallada del ticket es obligatoria.' }),

    definicionRequerimiento: Joi.string().max(4000).allow('', null).optional().default(''),

    capturaTicket: Joi.string().max(100).allow('', null).optional().default('no-imagen.png'),

    estadoTicket: Joi.string().max(100).optional().default('ABIERTO'),

    codigoUsuarioCreacion: Joi.string().max(200).required(),
    fechaCreacion: Joi.string().max(100).required(),
    codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
    fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const TicketAPDTO = (rawData) => {
    const { error, value } = TicketAPSchema.validate(rawData, { abortEarly: false });

    if (error) {
        throw {
            type: 'ValidationError',
            details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
        };
    }

    const fechaActual = new Date().toISOString();

    const estaAsignado = value.codigoUsuarioAsignado && value.codigoUsuarioAsignado !== 'SIN_ASIGNAR';
    const computedFechaAsignacion = value.fechaAsignacion || (estaAsignado ? fechaActual : 'PENDIENTE');

    return {
        codigoTicket: value.codigoTicket.trim(),
        codigoAplicacion: value.codigoAplicacion.trim(),
        codigoSuite: value.codigoSuite.trim(),
        codigoModulo: value.codigoModulo.trim(),
        codigoClase: value.codigoClase.trim(),
        fechaTicket: value.fechaTicket || fechaActual,
        nombreTicket: value.nombreTicket.trim(),
        codigoUsuarioSender: value.codigoUsuarioSender.trim(),
        codigoUsuarioAsignado: value.codigoUsuarioAsignado.trim(),
        fechaAsignacion: computedFechaAsignacion,
        prioridad: value.prioridad.trim().toUpperCase(),
        colorPrioridad: value.colorPrioridad.trim(),
        descripcionTicket: value.descripcionTicket.trim(),
        definicionRequerimiento: value.definicionRequerimiento.trim(),
        capturaTicket: value.capturaTicket.trim(),
        estadoTicket: value.estadoTicket.trim().toUpperCase(),

        codigoUsuarioCreacion: value.codigoUsuarioCreacion,
        fechaCreacion: value.fechaCreacion || fechaActual,
        codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
        fechaModificacion: value.fechaModificacion || fechaActual
    };
};

const TicketAPModel = (sequelize) => {
    return sequelize.define('PTLTicketsAP', {
        ticketId: {
            type: DataTypes.INTEGER,
            autoIncrement: true
        },
        codigoTicket: {
            type: DataTypes.STRING(50),
            primaryKey: true,
            allowNull: false
        },
        codigoAplicacion: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        codigoSuite: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        codigoModulo: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        codigoClase: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        fechaTicket: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        nombreTicket: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        codigoUsuarioSender: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        codigoUsuarioAsignado: {
            type: DataTypes.STRING(50),
            allowNull: false,
            defaultValue: 'SIN_ASIGNAR'
        },
        fechaAsignacion: {
            type: DataTypes.STRING(50),
            allowNull: false,
            defaultValue: 'PENDIENTE'
        },
        prioridad: {
            type: DataTypes.STRING(50),
            allowNull: false,
            defaultValue: 'NORMAL'
        },
        colorPrioridad: {
            type: DataTypes.STRING(50),
            allowNull: false,
            defaultValue: '#808080'
        },
        descripcionTicket: {
            type: DataTypes.STRING(4000),
            allowNull: false
        },
        definicionRequerimiento: {
            type: DataTypes.STRING(4000),
            allowNull: false
        },
        capturaTicket: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: 'no-imagen.png'
        },
        estadoTicket: {
            type: DataTypes.STRING(50),
            allowNull: false,
            defaultValue: 'ABIERTO'
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
        tableName: 'PTLTicketsAP',
        timestamps: false
    });
};

module.exports = {
    TicketAPModel,
    TicketAPDTO,
    TicketAPSchema
};