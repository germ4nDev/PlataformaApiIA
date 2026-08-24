/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Error Handling & Response Consistency
*/
const { response } = require("express");
const DbInitService = require("../services/db-script.service");

const service = new DbInitService();

const inicializarBaseDeDatos = async (req, res = response) => {
    try {
        const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';

        const resultado = await service.ejecutarScriptBD({ codigoUsuario: usuarioAccion });

        return res.status(200).json({
            ok: true,
            respuesta: resultado
        });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            ok: false,
            msg: error.msg || "Error crítico al inicializar la base de datos.",
            detalles: error.detalle || null
        });
    }
};

module.exports = {
    inicializarBaseDeDatos
};