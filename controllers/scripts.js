/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Audit Standards
*/
const { response } = require("express");
const ScriptsService = require("../services/scripts.service");

const service = new ScriptsService();

const getScripts = async (req, res = response) => {
    try {
        const scripts = await service.getScripts();
        return res.status(200).json({ ok: true, scripts });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            ok: false,
            msg: error.msg || "Error interno al obtener los scripts."
        });
    }
};

const getScriptById = async (req, res = response) => {
    try {
        const { id } = req.params;
        const script = await service.getScriptById(id);
        return res.status(200).json({ ok: true, script });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al obtener el script solicitado."
        });
    }
};

const createScript = async (req, res = response) => {
    try {
        // QPLUS: Inyección de auditoría con fallback a SISTEMA
        const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';
        const dataDTO = { ...req.body, codigoUsuario: usuarioAccion };

        const script = await service.createScript(dataDTO);
        return res.status(201).json({ ok: true, script });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al crear el script."
        });
    }
};

const updateScript = async (req, res = response) => {
    try {
        const { id } = req.params;

        // QPLUS: Hidratación del payload de auditoría
        const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';
        const dataDTO = { ...req.body, codigoUsuario: usuarioAccion };

        const script = await service.updateScript(id, dataDTO);
        return res.status(200).json({ ok: true, script });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al actualizar el script."
        });
    }
};

const deleteScript = async (req, res = response) => {
    try {
        const { id } = req.params;
        await service.deleteScript(id);

        return res.status(200).json({
            ok: true,
            msg: "Script eliminado correctamente."
        });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al eliminar el script."
        });
    }
};

module.exports = {
    getScripts,
    getScriptById,
    createScript,
    updateScript,
    deleteScript
};