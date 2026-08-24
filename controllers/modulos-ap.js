/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Error Handling
*/
const { response } = require("express");
const ModulosAPService = require("../services/modulos-ap.service");

const service = new ModulosAPService();

const getModulos = async (req, res = response) => {
    try {
        const modulos = await service.getModulos();
        return res.status(200).json({ ok: true, modulos });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            ok: false,
            msg: error.msg || "Error interno al obtener los módulos."
        });
    }
};

const getModuloById = async (req, res = response) => {
    try {
        const { id } = req.params;
        const modulo = await service.getModuloById(id);
        return res.status(200).json({ ok: true, modulo });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al obtener el módulo solicitado."
        });
    }
};

const createModulo = async (req, res = response) => {
    try {
        const dataDTO = { ...req.body };

        const modulo = await service.createModulo(dataDTO);
        return res.status(201).json({ ok: true, modulo });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al crear el módulo."
        });
    }
};

const updateModulo = async (req, res = response) => {
    try {
        const { id } = req.params;

        // QPLUS: Hidratación del payload de auditoría
        const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';
        const dataDTO = { ...req.body, codigoUsuario: usuarioAccion };

        const modulo = await service.updateModulo(id, dataDTO);
        return res.status(200).json({ ok: true, modulo });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al actualizar el módulo."
        });
    }
};

const deleteModulo = async (req, res = response) => {
    try {
        const { id } = req.params;
        await service.deleteModulo(id);

        return res.status(200).json({
            ok: true,
            msg: "Módulo eliminado correctamente."
        });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al eliminar el módulo."
        });
    }
};

module.exports = {
    getModulos,
    getModuloById,
    createModulo,
    updateModulo,
    deleteModulo
};