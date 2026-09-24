/*
    Author: German Valencia
    Pattern: PORTTOS DTO Pattern - Line Up Marítimo 
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

// 1. EL ESCUDO: Validación estricta de la data del Line Up entrante
const LineUpMaritimoSchema = Joi.object({
    puerto: Joi.string().max(100).allow(null, '').optional(),
    terminal: Joi.string().max(100).required(), // Ej: 'SPRBUN', 'TCBUEN', 'AGUADULCE'
    muelle: Joi.string().max(100).allow(null, '').optional(), // Ej: '1', '2', 'TBC'
    motonave: Joi.string().max(150).required(),
    lineaAgencia: Joi.string().max(150).allow('', null).optional(),
    eta: Joi.string().max(100).allow(null, '').optional(),
    fechaAtraque: Joi.string().max(100).allow(null, '').optional(),
    fechaZarpe: Joi.string().max(100).allow(null, '').optional(),
    eslora: Joi.number().allow(null, '').optional(),
    viaje: Joi.string().max(100).allow(null, '').optional(),

    trabajoOperacion: Joi.string().max(250).allow('', null).optional(), // Ej: '1000 DES / 200 CAR'
    posicion: Joi.string().max(100).default('ESPERADO'), // 'ESPERADO', 'FONDEO', 'EN PUERTO'
    novedades: Joi.string().allow('', null).optional()
});

// 2. EL ENSAMBLADOR: Construcción del DTO seguro y aplicación de auditoría unificada
const LineUpMaritimoDTO = (rawData, userContext) => {
    // stripUnknown: true limpia parámetros basura; abortEarly: false captura todos los errores simultáneamente
    const { error, value } = LineUpMaritimoSchema.validate(rawData, { abortEarly: false, stripUnknown: true });

    if (error) {
        throw {
            type: 'ValidationError',
            details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
        };
    }

    return {
        // Al usar IDENTITY(1,1) en SQL Server, omitimos el id en la creación para que la DB lo genere
        puerto: value.puerto ? value.puerto.trim().toUpperCase() : null,
        terminal: value.terminal.trim(),
        muelle: value.muelle && String(value.muelle).trim() !== '' ? String(value.muelle).trim().toUpperCase() : null,
        motonave: value.motonave.trim().toUpperCase(), // Estandarizamos el nombre del buque a mayúsculas
        lineaAgencia: value.lineaAgencia ? value.lineaAgencia.trim().toUpperCase() : null,
        viaje: value.viaje ? value.viaje.trim() : null,
        eslora: value.eslora || 0.00,
        eta: value.eta || null,
        fechaAtraque: value.fechaAtraque || null,
        fechaZarpe: value.fechaZarpe || null,
        trabajoOperacion: value.trabajoOperacion ? value.trabajoOperacion.trim() : null,
        posicion: value.posicion.trim().toUpperCase(),
        novedades: value.novedades || null,

        // Trazabilidad y banderas de estado integradas con el contexto operativo de PORTTOS
        estadoRegistro: true, // Por defecto activo al crearse
        codigoUsuarioCreacion: userContext.codigoUsuario,
        fechaCreacion: new Date(),
        codigoUsuarioModificacion: userContext.codigoUsuario,
        fechaModificacion: new Date()
    };
};

// 3. EL MAPEO: Definición estricta de Sequelize adaptada a T-SQL (SQL Server)
const LineUpMaritimoModel = (sequelize) => {
    return sequelize.define('TLCLineUpMaritimo', {
        idRegistroLineUp: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            field: 'idRegistroLineUp'
        },
        puerto: {
            type: DataTypes.STRING(100),
            field: 'puerto'
        },
        terminal: {
            type: DataTypes.STRING(100),
            allowNull: false,
            field: 'terminal'
        },
        muelle: {
            type: DataTypes.STRING(100),
            field: 'muelle'
        },
        motonave: {
            type: DataTypes.STRING(150),
            allowNull: false,
            field: 'motonave'
        },
        lineaAgencia: {
            type: DataTypes.STRING(150),
            allowNull: true,
            field: 'lineaAgencia'
        },
        viaje: {
            type: DataTypes.STRING(100),
            allowNull: true,
            field: 'viaje'
        },
        eslora: {
            type: DataTypes.DECIMAL(18, 2),
            allowNull: true,
            defaultValue: 0.00,
            field: 'eslora'
        },
        eta: {
            type: DataTypes.STRING(100),
            allowNull: true,
            field: 'eta'
        },
        fechaAtraque: {
            type: DataTypes.STRING(100),
            allowNull: true,
            field: 'fechaAtraque'
        },
        fechaZarpe: {
            type: DataTypes.STRING(100),
            allowNull: true,
            field: 'fechaZarpe'
        },
        trabajoOperacion: {
            type: DataTypes.STRING(250),
            allowNull: true,
            field: 'trabajoOperacion'
        },
        posicion: {
            type: DataTypes.STRING(100),
            allowNull: true,
            field: 'posicion'
        },
        novedades: {
            type: DataTypes.TEXT,
            allowNull: true,
            field: 'novedades'
        },

        // Atributos de Trazabilidad Manual PORTTOS
        estadoRegistro: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
            field: 'estadoRegistro'
        },
        codigoUsuarioCreacion: {
            type: DataTypes.STRING(200),
            allowNull: false,
            field: 'codigoUsuarioCreacion'
        },
        fechaCreacion: {
            type: DataTypes.STRING(100),
            allowNull: false,
            field: 'fechaCreacion'
        },
        codigoUsuarioModificacion: {
            type: DataTypes.STRING(200),
            allowNull: true,
            field: 'codigoUsuarioModificacion'
        },
        fechaModificacion: {
            type: DataTypes.STRING(100),
            allowNull: true,
            field: 'fechaModificacion'
        }
    }, {
        tableName: 'TLCLineUpMaritimo',
        schema: 'dbo',
        timestamps: false
    })
};

module.exports = {
    LineUpMaritimoModel,
    LineUpMaritimoDTO,
    LineUpMaritimoSchema
};