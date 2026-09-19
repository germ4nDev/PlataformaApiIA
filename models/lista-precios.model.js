/* eslint-disable no-useless-catch */
/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization, Joi Validation & SQL Server precision
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

// ==========================================
// 🟢 1. CABECERA (Lista de Precios)
// ==========================================
const ListaPreciosSchema = Joi.object({
    codigoLista: Joi.string().max(200).required(),
    nombreLista: Joi.string().max(150).required(),
    moneda: Joi.string().max(3).required(),
    paisAplica: Joi.string().max(100).allow('', null).optional(),
    fechaInicio: Joi.date().iso().required(),
    fechaFin: Joi.date().iso().allow(null).optional(),
    estadoLista: Joi.boolean().required().default(true),

    codigoUsuarioCreacion: Joi.string().max(200).allow('', null).optional(),
    fechaCreacion: Joi.string().max(100).allow('', null).optional(),
    codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
    fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const ListaPreciosDTO = (rawData) => {
    const { error, value } = ListaPreciosSchema.validate(rawData, { abortEarly: false, stripUnknown: true });
    if (error) {
        throw {
            type: 'ValidationError',
            details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
        };
    }
    const fechaActual = new Date().toISOString();
    return {
        ...value,
        codigoLista: value.codigoLista.trim().toUpperCase(),
        moneda: value.moneda.trim().toUpperCase(),
        fechaCreacion: value.fechaCreacion || fechaActual,
        fechaModificacion: value.fechaModificacion || fechaActual
    };
};

const ListaPreciosModel = (sequelize) => {
    return sequelize.define('PTLListasPrecios', {
        listaPrecioId: { type: DataTypes.INTEGER, autoIncrement: true },
        codigoLista: { type: DataTypes.STRING(200), primaryKey: true, allowNull: false },
        nombreLista: { type: DataTypes.STRING(150), allowNull: false },
        moneda: { type: DataTypes.STRING(3), allowNull: false },
        paisAplica: { type: DataTypes.STRING(100), allowNull: true },
        fechaInicio: { type: DataTypes.DATE, allowNull: false },
        fechaFin: { type: DataTypes.DATE, allowNull: true },
        estadoLista: { type: DataTypes.BOOLEAN, defaultValue: true },

        codigoUsuarioCreacion: { type: DataTypes.STRING(200), allowNull: true },
        fechaCreacion: { type: DataTypes.STRING(100), allowNull: true },
        codigoUsuarioModificacion: { type: DataTypes.STRING(200), allowNull: true },
        fechaModificacion: { type: DataTypes.STRING(100), allowNull: true }
    }, {
        tableName: 'PTLListasPrecios',
        timestamps: false
    });
};

// ==========================================
// 🟢 2. DETALLE (Precios de Paquetes e Ítems)
// ==========================================
const ListaPreciosDetalleSchema = Joi.object({
    codigoDetalle: Joi.string().max(200).required(),
    codigoLista: Joi.string().max(200).required(),
    tipoReferencia: Joi.string().valid('PAQUETE', 'ITEM').required(),
    codigoReferencia: Joi.string().max(200).required(),
    valorMensual: Joi.number().precision(2).min(0).required().default(0),
    valorAnual: Joi.number().precision(2).min(0).required().default(0),
    precioSetup: Joi.number().precision(2).min(0).allow(null).optional().default(0),
    estadoDetalle: Joi.boolean().required().default(true),

    codigoUsuarioCreacion: Joi.string().max(200).allow('', null).optional(),
    fechaCreacion: Joi.string().max(100).allow('', null).optional(),
    codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
    fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const ListaPreciosDetalleDTO = (rawData) => {
    const { error, value } = ListaPreciosDetalleSchema.validate(rawData, { abortEarly: false, stripUnknown: true });
    if (error) {
        throw {
            type: 'ValidationError',
            details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
        };
    }
    const fechaActual = new Date().toISOString();
    return {
        ...value,
        codigoDetalle: value.codigoDetalle.trim(),
        tipoReferencia: value.tipoReferencia.trim().toUpperCase(),
        fechaCreacion: value.fechaCreacion || fechaActual,
        fechaModificacion: value.fechaModificacion || fechaActual
    };
};

const ListaPreciosDetalleModel = (sequelize) => {
    return sequelize.define('PTLListasPreciosDetalle', {
        detalleListaId: { type: DataTypes.INTEGER, autoIncrement: true },
        codigoDetalle: { type: DataTypes.STRING(200), primaryKey: true, allowNull: false },
        codigoLista: { type: DataTypes.STRING(200), allowNull: false },
        tipoReferencia: { type: DataTypes.STRING(50), allowNull: false },
        codigoReferencia: { type: DataTypes.STRING(200), allowNull: false },
        valorMensual: { type: DataTypes.DECIMAL(18, 2), allowNull: false, defaultValue: 0 },
        valorAnual: { type: DataTypes.DECIMAL(18, 2), allowNull: false, defaultValue: 0 },
        precioSetup: { type: DataTypes.DECIMAL(18, 2), allowNull: true, defaultValue: 0 },
        estadoDetalle: { type: DataTypes.BOOLEAN, defaultValue: true },

        codigoUsuarioCreacion: { type: DataTypes.STRING(200), allowNull: true },
        fechaCreacion: { type: DataTypes.STRING(100), allowNull: true },
        codigoUsuarioModificacion: { type: DataTypes.STRING(200), allowNull: true },
        fechaModificacion: { type: DataTypes.STRING(100), allowNull: true }
    }, {
        tableName: 'PTLListasPreciosDetalle',
        timestamps: false
    });
};

module.exports = {
    ListaPreciosModel,
    ListaPreciosDTO,
    ListaPreciosDetalleModel,
    ListaPreciosDetalleDTO
};