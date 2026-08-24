/*
    Author: German Valencia
    Refactored for: QPLUS Architecture - Auth, Security Flow & Joi Validation
*/
const { response } = require('express');
const Joi = require('joi');

const TokenBlacklistService = {
    revokedUserIds: new Set(),

    revokeSession: function (userId) {
        this.revokedUserIds.add(userId.toString());
        return true;
    },

    isRevoked: function (userId) {
        return this.revokedUserIds.has(userId.toString());
    }
};

const verificarRolAdmin = (req, res = response, next) => {
    const usuarioSolicitante = req.usuario;

    if (!usuarioSolicitante) {
        return res.status(500).json({
            ok: false,
            msg: 'QPLUS-ERR: Se intentó verificar el rol sin validar el token JWT primero.'
        });
    }

    if (usuarioSolicitante.rol !== 'ADMIN_MASTER') {
        return res.status(403).json({
            ok: false,
            msg: 'Acceso denegado. Se requiere un rol de administrador maestro para esta acción.'
        });
    }

    next();
};

const checkBlacklist = (req, res = response, next) => {
    const userId = req.usuario?.uid || req.uid;

    if (!userId) {
        return res.status(500).json({
            ok: false,
            msg: 'QPLUS-ERR: No se pudo identificar al usuario en el payload para validar la sesión.'
        });
    }

    if (TokenBlacklistService.isRevoked(userId)) {
        return res.status(401).json({
            ok: false,
            msg: 'Su sesión ha sido revocada por un administrador. Por favor, inicie sesión nuevamente.'
        });
    }

    next();
};

const RevocarSesionSchema = Joi.object({
    id: Joi.alternatives().try(Joi.string(), Joi.number()).required()
        .messages({ 'any.required': 'El ID del usuario es obligatorio para revocar la sesión.' })
});

const revocarSesionUsuario = async (req, res = response) => {
    const { error, value } = RevocarSesionSchema.validate({ id: req.params.id });

    if (error) {
        return res.status(400).json({
            ok: false,
            msg: error.details[0].message
        });
    }

    const userIdToRevoke = value.id;
    const adminId = req.usuario?.uid || req.uid || 'SISTEMA';

    try {
        TokenBlacklistService.revokeSession(userIdToRevoke);

        // 3. Integración con el ecosistema de logs QPLUS (Ejemplo de implementación de tu TODO)
        /*
        const logData = LogActividadDTO({
            codigoAplicacion: 'PLATAFORMA_2.0',
            codigoSuite: 'SECURITY',
            codigoModulo: 'AUTH',
            codigoTipoLog: 'WARN',
            codigoRespuesta: 'SESSION_REVOKED',
            descripcionLog: `El administrador [${adminId}] revocó la sesión del usuario [${userIdToRevoke}].`,
            codigoUsuario: adminId
        });
        await LogActividadModel.create(logData);
        */

        res.json({
            ok: true,
            msg: `Las sesiones del usuario con ID ${userIdToRevoke} han sido revocadas exitosamente.`
        });

    } catch (error) {
        console.error('Error en revocarSesionUsuario:', error);

        res.status(500).json({
            ok: false,
            msg: 'Error interno del servidor al intentar revocar la sesión. Contacte al soporte técnico.'
        });
    }
};

module.exports = {
    TokenBlacklistService,
    verificarRolAdmin,
    checkBlacklist,
    revocarSesionUsuario
};