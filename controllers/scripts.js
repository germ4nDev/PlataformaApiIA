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
            msg: error.msg || "Error interno al obtener los scripts.",
            errores: error.details // CC-137: detalle del Joi
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
            msg: error.msg || "Error al obtener el script solicitado.",
            errores: error.details // CC-137: detalle del Joi
        });
    }
};

const createScript = async (req, res = response) => {
    try {
        // QPLUS: Inyección de auditoría con fallback a SISTEMA
        const usuarioAccion = req.codigoUsuario || 'SISTEMA'; // CC-137: del token (validarJWT)
        const dataDTO = { ...req.body, codigoUsuarioCreacion: usuarioAccion, codigoUsuarioModificacion: usuarioAccion };

        const script = await service.createScript(dataDTO);
        return res.status(201).json({ ok: true, script });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al crear el script.",
            errores: error.details // CC-137: detalle del Joi
        });
    }
};

const updateScript = async (req, res = response) => {
    try {
        const { id } = req.params;

        // QPLUS: Hidratación del payload de auditoría
        const usuarioAccion = req.codigoUsuario || 'SISTEMA'; // CC-137: del token (validarJWT)
        const dataDTO = { ...req.body, codigoUsuarioModificacion: usuarioAccion };

        const script = await service.updateScript(id, dataDTO);
        return res.status(200).json({ ok: true, script });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al actualizar el script.",
            errores: error.details // CC-137: detalle del Joi
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
            msg: error.msg || "Error al eliminar el script.",
            errores: error.details // CC-137: detalle del Joi
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