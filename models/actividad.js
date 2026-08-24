/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization & Joi Validation
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const ActividadSchema = Joi.object({
    codigoActividad: Joi.string().max(200).required()
        .messages({ 'any.required': 'El código de actividad es obligatorio.' }),
    codigoAplicacion: Joi.string().max(200).required()
        .messages({ 'any.required': 'El código de aplicación es obligatorio.' }),
    codigoSuite: Joi.string().max(200).required()
        .messages({ 'any.required': 'El código de suite es obligatorio.' }),
    codigoModulo: Joi.string().max(200).required()
        .messages({ 'any.required': 'El código de módulo es obligatorio.' }),
    codigoTipoActividad: Joi.string().max(200).required()
        .messages({ 'any.required': 'El código de tipo actividad es obligatorio.' }),
    actividad: Joi.string().max(4000).required()
        .messages({ 'any.required': 'El nombre de la actividad es obligatorio.' }),
    descripcion: Joi.string().max(4000).allow('', null).optional(),
    estadoActividad: Joi.boolean().optional().default(true),

    codigoUsuarioCreacion: Joi.string().max(200).required(),
    fechaCreacion: Joi.string().max(100).required(),
    codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
    fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const ActividadDTO = (rawData) => {
    const { error, value } = ActividadSchema.validate(rawData, { abortEarly: false });

    if (error) {
        throw {
            type: 'ValidationError',
            details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
        };
    }

    const fechaActual = new Date().toISOString();

    return {
        codigoActividad: value.codigoActividad.trim(),
        codigoAplicacion: value.codigoAplicacion.trim(),
        codigoSuite: value.codigoSuite.trim(),
        codigoModulo: value.codigoModulo.trim(),
        codigoTipoActividad: value.codigoTipoActividad.trim(),
        actividad: value.actividad.trim(),
        descripcion: value.descripcion || '',
        estadoActividad: value.estadoActividad,

        codigoUsuarioCreacion: value.codigoUsuarioCreacion,
        fechaCreacion: value.fechaCreacion || fechaActual,
        codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
        fechaModificacion: value.fechaModificacion || fechaActual
    };
};

const ActividadModel = (sequelize) => {
    return sequelize.define('PTLActividades', {
        actividadId: { type: DataTypes.INTEGER, autoIncrement: true },
        codigoActividad: { type: DataTypes.STRING(50), primaryKey: true, allowNull: false },
        codigoAplicacion: { type: DataTypes.STRING(50), allowNull: false },
        codigoSuite: { type: DataTypes.STRING(50), allowNull: false },
        codigoModulo: { type: DataTypes.STRING(50), allowNull: false },
        codigoTipoActividad: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        actividad: { type: DataTypes.STRING(100), allowNull: false },
        descripcion: { type: DataTypes.STRING(255), allowNull: true },
        estadoActividad: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
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
        tableName: 'PTLActividades',
        timestamps: false
    });
};

module.exports = {
    ActividadModel,
    ActividadDTO,
    ActividadSchema
};