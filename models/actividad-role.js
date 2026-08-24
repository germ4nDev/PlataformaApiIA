/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const ActividadRoleSchema = Joi.object({
    codigoActividadRole: Joi.string().max(200).required()
        .messages({ 'any.required': 'El código de actividadRole es obligatorio.' }),

    codigoActividad: Joi.string().max(200).required()
        .messages({ 'any.required': 'El código de actividad es obligatorio.' }),

    codigoRole: Joi.string().max(200).required()
        .messages({ 'any.required': 'El código de rol es obligatorio.' }),

    permiso: Joi.boolean().required()
        .messages({ 'any.required': 'El estado del permiso debe ser definido.' }),

    codigoUsuarioCreacion: Joi.string().max(200).required(),
    fechaCreacion: Joi.string().max(100).required(),
    codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
    fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const ActividadRoleDTO = (rawData) => {
    const { error, value } = ActividadRoleSchema.validate(rawData, { abortEarly: false });

    if (error) {
        throw {
            type: 'ValidationError',
            details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
        };
    }

    return {
        codigoActividadRole: value.codigoActividadRole.trim(),
        codigoActividad: value.codigoActividad.trim(),
        codigoRole: value.codigoRole.trim(),
        permiso: value.permiso,

        codigoUsuarioCreacion: value.codigoUsuarioCreacion,
        fechaCreacion: value.fechaCreacion || fechaActual,
        codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
        fechaModificacion: value.fechaModificacion || fechaActual
    };
};

const ActividadRoleModel = (sequelize) => {
    return sequelize.define('PTLActividadesRoles', {
        actividadRoleId: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            unique: true
        },
        codigoActividadRole: {
            type: DataTypes.STRING(200),
            primaryKey: true,
            allowNull: false
        },
        codigoActividad: {
            type: DataTypes.STRING(200),
            allowNull: false
        },
        codigoRole: {
            type: DataTypes.STRING(200),
            allowNull: false
        },
        permiso: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        codigoUsuarioCreacion: {
            type: DataTypes.STRING(200),
            allowNull: false
        },
        fechaCreacion: {
            type: DataTypes.STRING(100), // Recomendable usar DataTypes.DATE en el futuro
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
        tableName: 'PTLActividadesRoles',
        timestamps: false
    });
};

module.exports = {
    ActividadRoleModel,
    ActividadRoleDTO,
    ActividadRoleSchema
};