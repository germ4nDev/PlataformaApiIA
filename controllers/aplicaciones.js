/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Error Handling
*/
const { response } = require("express");
const AplicacionesService = require("../services/aplicaciones.service");

const service = new AplicacionesService();

const getAplicaciones = async (req, res = response) => {
    try {
        const aplicaciones = await service.getAplicaciones();
        return res.status(200).json({ ok: true, aplicaciones });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            ok: false,
            msg: error.msg || "Error interno al obtener aplicaciones."
        });
    }
};

const getAplicacionById = async (req, res = response) => {
    try {
        const { id } = req.params;
        // Corrección: Asumiendo que el servicio tiene un método específico para ID
        const aplicacion = await service.getAplicacionById(id);

        return res.status(200).json({ ok: true, aplicacion });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al obtener la aplicación."
        });
    }
};

const getAplicacionByCode = async (req, res = response) => {
    try {
        const { code } = req.params;
        const aplicacion = await service.getAplicacionByCode(code);

        return res.status(200).json({ ok: true, aplicacion });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al obtener la aplicación por código."
        });
    }
};

const createAplicacion = async (req, res = response) => {
    try {
        // QPLUS: Inyección del contexto de auditoría antes del servicio
        const codigoUsuarioCreacion = req.body?.codigoUsuarioCreacion || 'SISTEMA';
        const dataDTO = { ...req.body, codigoUsuarioCreacion };
        console.log('dataDTO', dataDTO);

        const aplicacionDB = await service.crearAplicacion(dataDTO);
        console.log('aplicacionDB', aplicacionDB);

        return res.status(201).json({ ok: true, aplicacionDB });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al crear la aplicación."
        });
    }
};

const updateAplicacion = async (req, res = response) => {
    try {
        const { codigoAplicacion, ...data } = req.body;

        // QPLUS: Hidratación del payload y delegación pura al servicio
        const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';
        const dataDTO = { ...data, codigoUsuario: usuarioAccion };

        const aplicacionActualizada = await service.updateAplicacion(codigoAplicacion, dataDTO);

        return res.status(200).json({ ok: true, aplicacionActualizada });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al actualizar la aplicación."
        });
    }
};

const deleteAplicacion = async (req, res = response) => {
    try {
        const { id } = req.params;
        await service.deleteAplicacion(id);

        return res.status(200).json({
            ok: true,
            msg: "Aplicación eliminada correctamente."
        });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al eliminar la aplicación."
        });
    }
};

module.exports = {
    getAplicaciones,
    getAplicacionById,
    getAplicacionByCode,
    createAplicacion,
    updateAplicacion,
    deleteAplicacion,
};