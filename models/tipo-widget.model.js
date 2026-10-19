/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization, Joi Validation & SQL Server precision
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const TipoWidgetSchema = Joi.object({
    codigoTipo: Joi.string().max(200).required(),
    nombreTipo: Joi.string().max(100).required(),
    descripcion: Joi.string().max(4000).allow('', null).optional(),
    estado: Joi.boolean().optional().default(true),

    codigoUsuarioCreacion: Joi.string().max(200).required(),
    fechaCreacion: Joi.string().max(100).required(),
    codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
    fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const TipoWidgetDTO = (rawData) => {
    const { error, value } = TipoWidgetSchema.validate(rawData, { abortEarly: false, stripUnknown: true });

    if (error) {
        throw {
            type: 'ValidationError',
            details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
        };
    }

    const fechaActual = new Date().toISOString();

    return {
        codigoTipo: value.codigoTipo.trim(),
        nombreTipo: value.nombreTipo.trim(),
        descripcion: value.descripcion.trim(),
        estado: value.estado,

        codigoUsuarioCreacion: value.codigoUsuarioCreacion,
        fechaCreacion: value.fechaCreacion || fechaActual,
        codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
        fechaModificacion: value.fechaModificacion || fechaActual
    };
};

const TipoWidgetModel = (sequelize) => {
    return sequelize.define('PTLTiposWidget', {
        idTipo: { type: DataTypes.INTEGER, autoIncrement: true },
        codigoTipo: { type: DataTypes.STRING(200), primaryKey: true, allowNull: false },
        nombreTipo: { type: DataTypes.STRING(100), allowNull: false },
        descripcion: { type: DataTypes.STRING(4000), allowNull: true },
        estado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },

        codigoUsuarioCreacion: { type: DataTypes.STRING(200), allowNull: true },
        fechaCreacion: { type: DataTypes.STRING(100), allowNull: true },
        codigoUsuarioModificacion: { type: DataTypes.STRING(200), allowNull: true },
        fechaModificacion: { type: DataTypes.STRING(100), allowNull: true }
    }, {
        tableName: 'PTLTiposWidget',
        timestamps: false
    });
};

module.exports = {
    TipoWidgetModel,
    TipoWidgetDTO,
    TipoWidgetSchema
};