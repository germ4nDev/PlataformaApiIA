/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization, Joi Validation & SQL Server precision
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const PestanaSchema = Joi.object({
    codigoPestana: Joi.string().max(200).required(),
    codigoAplicacion: Joi.string().max(200).required(),
    codigoSuite: Joi.string().max(200).required(),
    nombrePestana: Joi.string().max(100).required(),
    orden: Joi.number().integer().optional().default(0),
    descripcion: Joi.string().max(4000).allow('', null).optional(),
    estado: Joi.boolean().optional().default(true),

    codigoUsuarioCreacion: Joi.string().max(200).required(),
    fechaCreacion: Joi.string().max(100).required(),
    codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
    fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const PestanaDTO = (rawData) => {
    const { error, value } = PestanaSchema.validate(rawData, { abortEarly: false, stripUnknown: true });

    if (error) {
        throw {
            type: 'ValidationError',
            details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
        };
    }

    const fechaActual = new Date().toISOString();

    return {
        codigoPestana: value.codigoPestana.trim(),
        codigoAplicacion: value.codigoAplicacion.trim(),
        codigoSuite: value.codigoSuite.trim(),
        nombrePestana: value.nombrePestana.trim(),
        orden: value.orden,
        descripcion: value.descripcion.trim(),
        estado: value.estado,

        codigoUsuarioCreacion: value.codigoUsuarioCreacion,
        fechaCreacion: value.fechaCreacion || fechaActual,
        codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
        fechaModificacion: value.fechaModificacion || fechaActual
    };
};

const PestanaModel = (sequelize) => {
    return sequelize.define('PTLPestanas', {
        idPestana: { type: DataTypes.INTEGER, autoIncrement: true },
        codigoPestana: { type: DataTypes.STRING(200), primaryKey: true, allowNull: false },
        codigoAplicacion: { type: DataTypes.STRING(200), allowNull: false },
        codigoSuite: { type: DataTypes.STRING(200), allowNull: false },
        nombrePestana: { type: DataTypes.STRING(100), allowNull: false },
        orden: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        descripcion: { type: DataTypes.STRING(4000), allowNull: true },
        estado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },

        codigoUsuarioCreacion: { type: DataTypes.STRING(200), allowNull: true },
        fechaCreacion: { type: DataTypes.STRING(100), allowNull: true },
        codigoUsuarioModificacion: { type: DataTypes.STRING(200), allowNull: true },
        fechaModificacion: { type: DataTypes.STRING(100), allowNull: true }
    }, {
        tableName: 'PTLPestanas',
        timestamps: false
    });
};

module.exports = {
    PestanaModel,
    PestanaDTO,
    PestanaSchema
};