/*
    Author: German Valencia
    Pattern: PORTTOS DTO Pattern - Control de Movimientos de Contenedores
*/
const Joi = require('joi');
const { DataTypes, Sequelize } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

const ContenedorMovimientoSchema = Joi.object({
    idMovimiento: Joi.string().max(36).optional(),
    contenedor: Joi.string().min(5).max(50).required(),
    tipo: Joi.string().max(20).required(),
    naviera: Joi.string().max(50).required(),
    operacion: Joi.string().max(50).required(),
    ruta: Joi.string().max(100).required(),
    cliente: Joi.string().max(100).required(),
    freeTime: Joi.string().max(30).allow('', null).optional(),
    estado: Joi.string().valid('PROGRAMADO', 'EN RUTA', 'POR VENCER', 'PATIO LLENO - RUTEADO', 'DEMORA HOY').required(),

    // Auditoría opcional en la entrada
    fechaCreacion: Joi.string().optional(),
    fechaModificacion: Joi.string().optional()
});

const ContenedorMovimientoDTO = (rawData, userContext = { codigoUsuario: 'CRON_CONTENEDORES_SYS' }) => {
    const { error, value } = ContenedorMovimientoSchema.validate(rawData, { abortEarly: false, stripUnknown: true });

    if (error) {
        throw {
            type: 'ValidationError',
            details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
        };
    }

    const fechaActual = new Date().toISOString();
    const usuarioIngesta = userContext.codigoUsuario;

    return {
        id_movimiento: value.idMovimiento || uuidv4(),
        contenedor: value.contenedor.trim().toUpperCase(),
        tipo: value.tipo.trim(),
        naviera: value.naviera.trim().toUpperCase(),
        operacion: value.operacion.trim(),
        ruta: value.ruta.trim(),
        cliente: value.cliente.trim(),
        free_time: value.freeTime ? value.freeTime.trim() : '-',
        estado: value.estado.trim(),

        codigoUsuarioCreacion: usuarioIngesta,
        fechaCreacion: value.fechaCreacion || fechaActual,
        codigoUsuarioModificacion: usuarioIngesta,
        fechaModificacion: value.fechaModificacion || fechaActual
    };
};

const ContenedorMovimientoModel = (sequelize) => {
    return sequelize.define('TCL_MovimientosContenedor', {
        id_movimiento: {
            type: DataTypes.STRING(36),
            primaryKey: true,
            allowNull: false
        },
        contenedor: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        tipo: {
            type: DataTypes.STRING(20),
            allowNull: false
        },
        naviera: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        operacion: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        ruta: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        cliente: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        free_time: {
            type: DataTypes.STRING(30),
            allowNull: true
        },
        estado: {
            type: DataTypes.STRING(50),
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
        tableName: 'TCL_MovimientosContenedor',
        schema: 'dbo',
        timestamps: false
    });
};

module.exports = { ContenedorMovimientoModel, ContenedorMovimientoDTO, ContenedorMovimientoSchema };