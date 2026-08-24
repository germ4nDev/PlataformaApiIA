/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Standardized Error Handling
*/
const { response } = require('express');
const ScriptsService = require('../services/admin-scripts.service');

const service = new ScriptsService();

const ejecutarScript = async (req, res = response) => {
    try {
        // QPLUS: Inyección de contexto de auditoría (quién ejecuta el script)
        const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';

        const rawData = {
            nombreArchivo: req.body.archivo,
            nombreDb: req.body.database,
            codigoUsuario: usuarioAccion
        };

        const mensajeExito = await service.ejecutarScript(rawData);

        return res.status(200).json({
            ok: true,
            msg: "Operación exitosa", // Opcional, para consistencia
            respuesta: mensajeExito   // QPLUS: Llave de payload estandarizada
        });

    } catch (error) {
        // QPLUS: Limpieza de console.error y delegación estricta al servicio
        return res.status(error.statusCode || 500).json({
            ok: false,
            msg: error.msg || error.message || 'Error al procesar el archivo o ejecutar el script.',
            detalles: error.details || (error.original ? error.original.message : null)
        });
    }
};

const ejecutarScriptMultiDb = async (req, res = response) => {
    try {
        const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';

        const rawData = {
            nombreArchivo: req.body.archivo,
            nombresDbs: req.body.databases,
            codigoUsuario: usuarioAccion
        };

        const resultados = await service.ejecutarScriptMultiDb(rawData);

        // Uso excelente del 207 Multi-Status
        if (resultados.fallidos?.length === 0) {
            return res.status(200).json({
                ok: true,
                msg: 'Script ejecutado con éxito en TODAS las bases de datos.',
                respuesta: resultados // QPLUS: Llave de payload estandarizada
            });
        } else {
            return res.status(207).json({
                ok: false, // Puedes evaluar si mantener false o true dependiendo de tu frontend en Angular
                msg: 'El proceso terminó, pero hubo errores en algunas bases de datos.',
                respuesta: resultados
            });
        }

    } catch (error) {
        return res.status(error.statusCode || 500).json({
            ok: false,
            msg: error.msg || error.message || 'Error crítico al procesar la solicitud de ejecución masiva.',
            detalles: error.details || null
        });
    }
};

module.exports = {
    ejecutarScript,
    ejecutarScriptMultiDb
};