/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization & Joi Validation
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const ConexionesBDSchema = Joi.object({
    codigoConexion: Joi.string().max(20).required()
        .messages({ 'any.required': 'El código de la conexión es obligatorio.' }),

    codigoSuscriptor: Joi.string().max(20).required()
        .messages({ 'any.required': 'El código del suscriptor es obligatorio.' }),

    codigoPaquete: Joi.string().max(20).required()
        .messages({ 'any.required': 'El código del paquete es obligatorio.' }),

    codigoAplicacion: Joi.string().max(20).required()
        .messages({ 'any.required': 'El código de la aplicación es obligatorio.' }),

    nombreConexion: Joi.string().max(100).required()
        .messages({ 'any.required': 'El nombre de la conexión es obligatorio.' }),

    nombreServidor: Joi.string().max(100).required()
        .messages({ 'any.required': 'El host o nombre del servidor es obligatorio.' }),

    BDNombre: Joi.string().max(100).required()
        .messages({ 'any.required': 'El nombre de la base de datos es obligatorio.' }),

    BDUser: Joi.string().max(100).required()
        .messages({ 'any.required': 'El usuario de la base de datos es obligatorio.' }),

    BDPassword: Joi.string().max(100).required()
        .messages({ 'any.required': 'La contraseña de la base de datos es obligatoria.' }),

    BDPort: Joi.number().integer().positive().max(65535).required()
        .messages({
            'any.required': 'El puerto es obligatorio.',
            'number.max': 'El puerto no puede ser superior a 65535.'
        }),

    descripcionConexion: Joi.string().max(4000).allow('', null).optional(),

    estadoConexion: Joi.boolean().optional().default(true),

    codigoUsuarioCreacion: Joi.string().max(200).required(),
    fechaCreacion: Joi.string().max(100).required(),
    codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
    fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

const ConexionesBDDTO = (rawData) => {
    const { error, value } = ConexionesBDSchema.validate(rawData, { abortEarly: false });

    if (error) {
        throw {
            type: 'ValidationError',
            details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
        };
    }

    const fechaActual = new Date().toISOString();

    return {
        codigoConexion: value.codigoConexion.trim(),
        codigoSuscriptor: value.codigoSuscriptor.trim(),
        codigoPaquete: value.codigoPaquete.trim(),
        codigoAplicacion: value.codigoAplicacion.trim(),
        nombreConexion: value.nombreConexion.trim(),
        nombreServidor: value.nombreServidor.trim(),
        BDNombre: value.BDNombre.trim(),
        BDUser: value.BDUser.trim(),
        BDPassword: value.BDPassword, // No aplicamos trim a contraseñas para permitir espacios si existen
        BDPort: value.BDPort,
        descripcionConexion: value.descripcionConexion || '',
        estadoConexion: value.estadoConexion,

        codigoUsuarioCreacion: value.codigoUsuarioCreacion,
        fechaCreacion: value.fechaCreacion || fechaActual,
        codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
        fechaModificacion: value.fechaModificacion || fechaActual
    };
};

const ConexionesBDModel = (sequelize) => {
    return sequelize.define('PTLConexionesBD', {
        conexionId: {
            type: DataTypes.INTEGER,
            autoIncrement: true
        },
        codigoConexion: {
            type: DataTypes.STRING(200),
            primaryKey: true,
            allowNull: false
        },
        codigoSuscriptor: {
            type: DataTypes.STRING(200),
            allowNull: false
        },
        codigoPaquete: {
            type: DataTypes.STRING(200),
            allowNull: false
        },
        codigoAplicacion: {
            type: DataTypes.STRING(200),
            allowNull: false
        },
        nombreConexion: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        nombreServidor: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        BDNombre: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        BDUser: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        BDPassword: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        BDPort: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        descripcionConexion: {
            type: DataTypes.STRING(4000),
            allowNull: false
        },
        estadoConexion: {
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
        tableName: 'PTLConexionesBD',
        timestamps: false
    });
};

module.exports = {
    ConexionesBDModel,
    ConexionesBDDTO,
    ConexionesBDSchema
};