/*
    Author: German Valencia
    Refactored for: QPLUS DTO Pattern, Entity Standardization, Joi Validation & SQL Server precision
*/
const Joi = require('joi');
const { DataTypes } = require('sequelize');

// ==========================================
// 1. ESQUEMA DE VALIDACIÓN (JOI)
// ==========================================
const ParametroSistemaSchema = Joi.object({
    codigoParametro: Joi.string().max(200).required(),
    llaveParametro: Joi.string().max(200).required(),
    nombreParametro: Joi.string().max(100).required(),
    descripcionParametro: Joi.string().max(4000).allow('', null).optional().default(''),
    valorParametro: Joi.string().max(4000).required(),
    tipoDato: Joi.string().max(50).valid('DECIMAL', 'INTEGER', 'BOOLEAN', 'STRING').required(),
    estadoParametro: Joi.boolean().optional().default(true),

    // Auditoría QPLUS
    codigoUsuarioCreacion: Joi.string().max(200).required(),
    fechaCreacion: Joi.string().max(100).required(),
    codigoUsuarioModificacion: Joi.string().max(200).allow('', null).optional(),
    fechaModificacion: Joi.string().max(100).allow('', null).optional()
});

// ==========================================
// 2. DTO (SANITIZACIÓN Y TRANSFORMACIÓN)
// ==========================================
const ParametroSistemaDTO = (rawData) => {
    const { error, value } = ParametroSistemaSchema.validate(rawData, { abortEarly: false, stripUnknown: true });

    if (error) {
        throw {
            type: 'ValidationError',
            details: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
        };
    }

    const fechaActual = new Date().toISOString();

    return {
        codigoParametro: value.codigoParametro.trim(),
        // Forzamos la llave a mayúsculas y sin espacios para evitar errores de búsqueda en el backend
        llaveParametro: value.llaveParametro.trim().toUpperCase(),
        nombreParametro: value.nombreParametro.trim(),
        descripcionParametro: value.descripcionParametro.trim(),
        valorParametro: value.valorParametro.trim(),
        tipoDato: value.tipoDato.trim().toUpperCase(),
        estadoParametro: value.estadoParametro,

        codigoUsuarioCreacion: value.codigoUsuarioCreacion,
        fechaCreacion: value.fechaCreacion || fechaActual,
        codigoUsuarioModificacion: value.codigoUsuarioModificacion || value.codigoUsuarioCreacion,
        fechaModificacion: value.fechaModificacion || fechaActual
    };
};

// ==========================================
// 3. MODELO SEQUELIZE (MAPEO BD)
// ==========================================
const ParametroSistemaModel = (sequelize) => {
    return sequelize.define('PTLParametrosSistema', {
        parametroId: { type: DataTypes.INTEGER, autoIncrement: true },
        codigoParametro: { type: DataTypes.STRING(200), primaryKey: true, allowNull: false },
        llaveParametro: { type: DataTypes.STRING(200), allowNull: false, unique: true },
        nombreParametro: { type: DataTypes.STRING(100), allowNull: false },
        descripcionParametro: { type: DataTypes.STRING(4000), allowNull: true, defaultValue: '' },
        valorParametro: { type: DataTypes.STRING(4000), allowNull: false },
        tipoDato: { type: DataTypes.STRING(50), allowNull: false },
        estadoParametro: { type: DataTypes.BOOLEAN, defaultValue: true },

        // Auditoría
        codigoUsuarioCreacion: { type: DataTypes.STRING(200), allowNull: true },
        fechaCreacion: { type: DataTypes.STRING(100), allowNull: true },
        codigoUsuarioModificacion: { type: DataTypes.STRING(200), allowNull: true },
        fechaModificacion: { type: DataTypes.STRING(100), allowNull: true }
    }, {
        tableName: 'PTLParametrosSistema',
        timestamps: false
    });
};

module.exports = {
    ParametroSistemaModel,
    ParametroSistemaDTO,
    ParametroSistemaSchema
};