/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Audit Standards
*/
const { response } = require("express");
const TipoScriptService = require("../services/tipos-scripts.service");

const service = new TipoScriptService();

const getTiposScripts = async (req, res = response) => {
    try {
        const tipos = await service.getTiposScripts();
        return res.status(200).json({ ok: true, tipos });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            ok: false,
            msg: error.msg || "Error interno al obtener los tipos de script."
        });
    }
};

const getTipoScriptById = async (req, res = response) => {
    try {
        const { id } = req.params;
        const tipo = await service.getTipoScriptById(id);
        return res.status(200).json({ ok: true, tipo });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al obtener el tipo de script solicitado."
        });
    }
};

const createTipoScript = async (req, res = response) => {
    try {
        // QPLUS: Inyección de auditoría
        const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';
        const dataDTO = { ...req.body, codigoUsuario: usuarioAccion };

        const tipo = await service.createTipoScript(dataDTO);
        return res.status(201).json({ ok: true, tipo });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al crear el tipo de script."
        });
    }
};

const updateTipoScript = async (req, res = response) => {
    try {
        const { id } = req.params;

        // QPLUS: Hidratación del payload de auditoría
        const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';
        const dataDTO = { ...req.body, codigoUsuario: usuarioAccion };

        const tipo = await service.updateTipoScript(id, dataDTO);
        return res.status(200).json({ ok: true, tipo });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al actualizar el tipo de script."
        });
    }
};

const deleteTipoScript = async (req, res = response) => {
    try {
        const { id } = req.params;
        await service.deleteTipoScript(id);

        return res.status(200).json({
            ok: true,
            msg: "Tipo de script eliminado correctamente."
        });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al eliminar el tipo de script."
        });
    }
};

module.exports = {
    getTiposScripts,
    getTipoScriptById,
    createTipoScript,
    updateTipoScript,
    deleteTipoScript
};