/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern & SQL Server Schema Alignment
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

    // 🟢 Alineado con BD: Permitimos nulos para que no bloquee el guardado masivo
    codigoUsuarioCreacion: Joi.string().max(200).allow('', null).optional(),
    fechaCreacion: Joi.string().max(100).allow('', null).optional(),
    codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
    fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const ActividadRoleDTO = (rawData) => {
    // 🟢 VITAL: stripUnknown para ignorar las propiedades 'checked' o 'nomEstado' que envía Angular
    const { error, value } = ActividadRoleSchema.validate(rawData, {
        abortEarly: false,
        stripUnknown: true
    });

    if (error) {
        throw {
            type: 'ValidationError',
            details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
        };
    }

    const fechaActual = new Date().toISOString();

    return {
        codigoActividadRole: value.codigoActividadRole.trim(),
        codigoActividad: value.codigoActividad.trim(),
        codigoRole: value.codigoRole.trim(),
        permiso: value.permiso,

        codigoUsuarioCreacion: value.codigoUsuarioCreacion || '',
        fechaCreacion: value.fechaCreacion || fechaActual,
        codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion || '',
        fechaModificacion: value.fechaModificacion || fechaActual
    };
};

const ActividadRoleModel = (sequelize) => {
    const PTLActividadesRoles = sequelize.define('PTLActividadesRoles', {
        actividadRoleId: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            unique: true,
            allowNull: false // 🟢 En la BD no tiene el check de Allow Nulls
        },
        codigoActividadRole: {
            type: DataTypes.STRING(200),
            primaryKey: true, // 🔑 En la BD tiene el ícono de llave primaria
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
        // 🟢 CORRECCIONES: Todos pasados a allowNull: true por el check azul en SQL Server
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
        tableName: 'PTLActividadesRoles',
        timestamps: false
    });

    PTLActividadesRoles.associate = (models) => {
        PTLActividadesRoles.belongsTo(models.PTLActividades, {
            foreignKey: 'codigoActividad',
            targetKey: 'codigoActividad',
            as: 'actividad'
        });
    };

    return PTLActividadesRoles;
};

module.exports = {
    ActividadRoleModel,
    ActividadRoleDTO,
    ActividadRoleSchema
};