/*
    Author: German Valencia
    Pattern: QPLUS DTO Pattern - AIS Última Posición Conocida
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const AisPosicionSchema = Joi.object({
    mmsi: Joi.alt(Joi.string(), Joi.number()).required(),
    nombreMotonave: Joi.string().max(150).allow('', null).optional(),
    lat: Joi.number().min(-90).max(90).required(),
    lon: Joi.number().min(-180).max(180).required(),
    velocidad: Joi.number().min(0).required(),
    rumbo: Joi.number().min(0).max(360).allow(null, 360).optional(),
    destino: Joi.string().max(150).allow('', null).optional(),
    estadoInferido: Joi.string().valid('DETENIDO', 'EN MOVIMIENTO').required()
});

const AisPosicionDTO = (rawData, userContext = { codigoUsuario: 'CRON_AIS_SYS' }) => {
    const { error, value } = AisPosicionSchema.validate(rawData, { abortEarly: false, stripUnknown: true });

    if (error) {
        throw {
            type: 'ValidationError',
            details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
        };
    }

    const fechaISO = new Date().toISOString();
    const usuarioIngesta = userContext.codigoUsuario;

    return {
        mmsi: String(value.mmsi).trim(),
        nombre_motonave: value.nombreMotonave ? value.nombreMotonave.trim().toUpperCase() : null,
        latitud: value.lat,
        longitud: value.lon,
        velocidad: value.velocidad,
        rumbo: value.rumbo === 360 ? null : value.rumbo, // 360 en AIS significa "rumbo no disponible"
        destino: value.destino ? value.destino.trim().toUpperCase() : null,
        estado_inferido: value.estadoInferido,

        codigoUsuarioCreacion: usuarioIngesta,
        fechaCreacion: value.fechaCreacion,
        codigoUsuarioModificacion: usuarioIngesta,
        fechaModificacion: value.fechaModificacion
    };
};

const AisUltimaPosicionModel = (sequelize) => {
    return sequelize.define('TCLAisUltimaPosicion', {
        mmsi: {
            type: DataTypes.STRING(20),
            primaryKey: true,
            allowNull: false,
            field: 'mmsi'
        },
        nombre_motonave: {
            type: DataTypes.STRING(150),
            allowNull: true
        },
        latitud: {
            type: DataTypes.DECIMAL(18, 6),
            allowNull: false
        },
        longitud: {
            type: DataTypes.DECIMAL(18, 6),
            allowNull: false
        },
        velocidad: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: false
        },
        rumbo: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: true
        },
        destino: {
            type: DataTypes.STRING(150),
            allowNull: true
        },
        estado_inferido: {
            type: DataTypes.STRING(30),
            allowNull: false
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
            allowNull: true
        },
        fechaModificacion: {
            type: DataTypes.STRING(100),
            allowNull: true
        }
    }, {
        tableName: 'TCLAisUltimaPosicion',
        schema: 'dbo',
        timestamps: false
    });
};

module.exports = { AisUltimaPosicionModel, AisPosicionDTO, AisPosicionSchema };