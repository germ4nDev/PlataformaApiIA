/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization & Joi Validation
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

const SliderInicioSchema = Joi.object({
    codigoSlider: Joi.string().max(200).required()
        .messages({ 'any.required': 'El código del slider es obligatorio.' }),

    nombreSlider: Joi.string().max(100).required()
        .messages({ 'any.required': 'El nombre descriptivo del slider es obligatorio.' }),

    urlSlider: Joi.string().max(200).allow('', null).optional().default('no-imagen.png'),

    descripcionSlider: Joi.string().max(4000).allow('').required()
        .messages({ 'any.required': 'La descripción del slider es obligatoria.' }),

    estadoSlider: Joi.boolean().optional().default(true),

    // Slides por aplicación (migración 027, CC-104): NULL o vacío = slide general
    codigoAplicacion: Joi.string().max(200).allow('', null).optional(),

    // Auditoría (CC-104): la gestión de la web no manda la creación; la pone el API con el usuario de la acción
    codigoUsuario: Joi.string().max(200).allow('', null).optional(),
    codigoUsuarioCreacion: Joi.string().max(200).allow('', null).optional(),
    fechaCreacion: Joi.string().max(100).allow('', null).optional(),
    codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
    fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

/**
 * modo 'crear' (por defecto) arma la fila completa; 'actualizar' no toca los datos de creación.
 * Campos que no son del slider (p. ej. los del formulario de la web) se descartan en vez de rechazar todo (CC-104:
 * antes, codigoUsuario que agrega el controlador hacía fallar toda creación).
 */
const SliderInicioDTO = (rawData, modo = 'crear') => {
    const { error, value } = SliderInicioSchema.validate(rawData, { abortEarly: false, stripUnknown: true });

    if (error) {
        throw {
            type: 'ValidationError',
            details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
        };
    }

    const fechaActual = new Date().toISOString();

    const usuario = value.codigoUsuarioModificacion || value.codigoUsuario || value.codigoUsuarioCreacion || 'SISTEMA';
    const dto = {
        codigoSlider: value.codigoSlider.trim(),
        nombreSlider: value.nombreSlider.trim(),
        urlSlider: (value.urlSlider || '').trim() || 'no-imagen.png',
        descripcionSlider: value.descripcionSlider.trim(),
        estadoSlider: value.estadoSlider,
        codigoUsuarioModificacion: usuario,
        fechaModificacion: value.fechaModificacion || fechaActual
    };
    if (modo !== 'actualizar') {
        dto.codigoUsuarioCreacion = value.codigoUsuarioCreacion || value.codigoUsuario || usuario;
        dto.fechaCreacion = value.fechaCreacion || fechaActual;
    }
    // Solo si vino en la petición: el servicio lo quita si la columna aún no existe (sin la 027)
    if (Object.prototype.hasOwnProperty.call(rawData || {}, 'codigoAplicacion')) {
        dto.codigoAplicacion = (value.codigoAplicacion || '').trim() || null;
    }
    return dto;
};

/** conAplicacion: la tabla ya tiene la columna codigoAplicacion (migración 027). Sin ella, el modelo de siempre. */
const SliderInicioModel = (sequelize, { conAplicacion = false } = {}) => {
    const columnaApp = conAplicacion ? { codigoAplicacion: { type: DataTypes.STRING(200), allowNull: true } } : {};
    return sequelize.define(conAplicacion ? 'PTLSliderInicioApp' : 'PTLSliderInicio', {
        sliderId: {
            type: DataTypes.INTEGER,
            autoIncrement: true
        },
        codigoSlider: {
            type: DataTypes.STRING(200),
            primaryKey: true,
            allowNull: false
        },
        nombreSlider: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        urlSlider: {
            type: DataTypes.STRING(200),
            allowNull: false,
            defaultValue: 'no-imagen.png'
        },
        descripcionSlider: {
            type: DataTypes.STRING(4000),
            allowNull: false
        },
        estadoSlider: {
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
        },
        ...columnaApp
    }, {
        tableName: 'PTLSliderInicio',
        timestamps: false
    });
};

module.exports = {
    SliderInicioModel,
    SliderInicioDTO,
    SliderInicioSchema
};