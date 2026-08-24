/*
    Author: German Valencia
    Pattern: QPLUS DTO Pattern - Dashboard Layout Persistence
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');
const { se } = require('../../database/connection');
const { v4: uuidv4 } = require('uuid');

// Solo validamos los datos operativos que viajan desde el frontend
const DashboardLayoutSchema = Joi.object({
    codigoUsuario: Joi.string().max(200).required(),
    codigoDashboard: Joi.string().max(100).required(),
    widget_id: Joi.string().max(100).required(),
    posicion_x: Joi.number().integer().min(0).required(),
    posicion_y: Joi.number().integer().min(0).required(),
    config: Joi.alternatives().try(Joi.string(), Joi.object()).allow(null, '').optional()
});

// Recibimos la data cruda (rawData) y el contexto de seguridad (userContext)
const DashboardLayoutDTO = (rawData, userContext) => {
    // stripUnknown: true limpia cualquier basura extra que envíe el frontend
    const { error, value } = DashboardLayoutSchema.validate(rawData, { abortEarly: false, stripUnknown: true });

    if (error) {
        throw {
            type: 'ValidationError',
            details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
        };
    }

    return {
        codigoLayout: uuidv4(), // Generación de llave primaria única por fila

        codigoUsuario: value.codigoUsuario.trim(),
        codigoDashboard: value.codigoDashboard.trim(),
        widget_id: value.widget_id.trim(),
        posicion_x: value.posicion_x,
        posicion_y: value.posicion_y,
        config: typeof value.config === 'object' ? JSON.stringify(value.config) : value.config,

        // Auditoría automática aplicada con el contexto del middleware
        codigoUsuarioCreacion: userContext.codigoUsuario,
        fechaCreacion: new Date(),
        codigoUsuarioModificacion: userContext.codigoUsuario,
        fechaModificacion: new Date()
    };
};

const DashboardLayoutModel = (sequelize) => {
    return sequelize.define('TLCUserDashboardLayout', {
        codigoLayout: {
            type: DataTypes.STRING,
            primaryKey: true,
            allowNull: false
        },
        codigoUsuario: {
            type: DataTypes.STRING(200),
            allowNull: false
        },
        codigoDashboard: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        widget_id: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        posicion_x: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        posicion_y: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        config: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        // Campos de Auditoría QPLUS
        codigoUsuarioCreacion: {
            type: DataTypes.STRING(200),
            allowNull: false
        },
        fechaCreacion: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        codigoUsuarioModificacion: {
            type: DataTypes.STRING(200),
            allowNull: true
        },
        fechaModificacion: {
            type: DataTypes.DATE,
            allowNull: true
        }
    }, {
        tableName: 'TLCUserDashboardLayout',
        timestamps: false
    });
};

module.exports = {
    DashboardLayoutModel,
    DashboardLayoutDTO,
    DashboardLayoutSchema
};