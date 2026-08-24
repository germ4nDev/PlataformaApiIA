/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization, Joi Validation & SQL Server precision
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const ItemPaqueteSchema = Joi.object({
    codigoItem: Joi.string().max(200).required()
        .messages({ 'any.required': 'El código del ítem es obligatorio.' }),

    codigoPaquete: Joi.string().max(200).required()
        .messages({ 'any.required': 'El código del paquete vinculado es obligatorio.' }),

    codigoValor: Joi.string().max(200).required()
        .messages({ 'any.required': 'El código de valor es obligatorio.' }),

    tipoValorId: Joi.number().integer().positive().required()
        .messages({ 'any.required': 'El ID del tipo de valor es obligatorio.' }),

    nombreItem: Joi.string().max(200).required()
        .messages({ 'any.required': 'El nombre del ítem es obligatorio.' }),

    descripcionItem: Joi.string().max(4000).allow('').required()
        .messages({ 'any.required': 'La descripción del ítem es obligatoria.' }),

    cantidad: Joi.number().integer().min(1).optional().default(1),

    valorUnitario: Joi.number().precision(2).min(0).optional().default(0.00),
    valorTotal: Joi.number().precision(2).min(0).optional().default(0.00),
    valoresAdicionales: Joi.number().precision(2).min(0).optional().default(0.00),

    estadoItem: Joi.boolean().optional().default(true),

    codigoUsuarioCreacion: Joi.string().max(200).required(),
    fechaCreacion: Joi.string().max(100).required(),
    codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
    fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const ItemPaqueteDTO = (rawData) => {
    const { error, value } = ItemPaqueteSchema.validate(rawData, { abortEarly: false });

    if (error) {
        throw {
            type: 'ValidationError',
            details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
        };
    }

    const fechaActual = new Date().toISOString();

    return {
        codigoItem: value.codigoItem.trim(),
        codigoPaquete: value.codigoPaquete.trim(),
        codigoValor: value.codigoValor.trim(),
        tipoValorId: value.tipoValorId,
        nombreItem: value.nombreItem.trim(),
        descripcionItem: value.descripcionItem.trim(),
        cantidad: value.cantidad,
        valorUnitario: value.valorUnitario,
        valorTotal: value.valorTotal,
        valoresAdicionales: value.valoresAdicionales,
        estadoItem: value.estadoItem,

        codigoUsuarioCreacion: value.codigoUsuarioCreacion,
        fechaCreacion: value.fechaCreacion || fechaActual,
        codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
        fechaModificacion: value.fechaModificacion || fechaActual
    };
};

const ItemPaqueteModel = (sequelize) => {
    return sequelize.define('PTLItemsPaquete', {
        itemId: {
            type: DataTypes.INTEGER,
            autoIncrement: true
        },
        codigoItem: {
            type: DataTypes.STRING(200),
            primaryKey: true,
            allowNull: false
        },
        codigoPaquete: {
            type: DataTypes.STRING(200),
            allowNull: false
        },
        codigoValor: {
            type: DataTypes.STRING(200),
            allowNull: false
        },
        tipoValorId: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        nombreItem: {
            type: DataTypes.STRING(200),
            allowNull: false
        },
        descripcionItem: {
            type: DataTypes.STRING(4000),
            allowNull: false
        },
        cantidad: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1
        },
        valorUnitario: {
            type: DataTypes.DECIMAL(18, 2),
            allowNull: false,
            defaultValue: 0.00
        },
        valorTotal: {
            type: DataTypes.DECIMAL(18, 2),
            allowNull: false,
            defaultValue: 0.00
        },
        valoresAdicionales: {
            type: DataTypes.DECIMAL(18, 2),
            allowNull: false,
            defaultValue: 0.00
        },
        estadoItem: {
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
        tableName: 'PTLItemsPaquete',
        timestamps: false
    });
};

module.exports = {
    ItemPaqueteModel,
    ItemPaqueteDTO,
    ItemPaqueteSchema
};