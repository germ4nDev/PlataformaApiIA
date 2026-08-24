/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Error Handling
*/
const { response } = require("express");
const ModuloPaqueteService = require("../services/modulos-paquete.service");

const service = new ModuloPaqueteService();

const getModulosPaquete = async (req, res = response) => {
    try {
        const modulos = await service.getModulosPaquete();
        return res.status(200).json({ ok: true, modulos });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            ok: false,
            msg: error.msg || "Error interno al obtener los módulos del paquete."
        });
    }
};

const getModulosPaqueteById = async (req, res = response) => {
    try {
        const { id } = req.params;
        const modulo = await service.getModulosPaqueteById(id);
        return res.status(200).json({ ok: true, modulo });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al obtener el módulo de paquete solicitado."
        });
    }
};

const getModulosPaqueteByCode = async (req, res = response) => {
    try {
        const { codigoPaquete } = req.params;
        const modulos = await service.getModulosPaqueteByCode(codigoPaquete);
        return res.status(200).json({ ok: true, modulos });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al obtener módulos por código de paquete."
        });
    }
};

const createModulosPaquete = async (req, res = response) => {
    try {
        const dataDTO = { ...req.body };

        const modulo = await service.createModulosPaquete(dataDTO);
        return res.status(201).json({ ok: true, modulo });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al crear la relación módulo-paquete."
        });
    }
};

const updateModulosPaquete = async (req, res = response) => {
    try {
        const { id } = req.params;

        // QPLUS: Hidratación del payload
        const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';
        const dataDTO = { ...req.body, codigoUsuario: usuarioAccion };

        const modulo = await service.updateModulosPaquete(id, dataDTO);
        return res.status(200).json({ ok: true, modulo });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al actualizar la relación módulo-paquete."
        });
    }
};

const deleteModulosPaquete = async (req, res = response) => {
    try {
        const { id } = req.params;
        await service.deleteModulosPaquete(id);

        return res.status(200).json({
            ok: true,
            msg: "Relación módulo-paquete eliminada correctamente."
        });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al eliminar la relación módulo-paquete."
        });
    }
};

module.exports = {
    getModulosPaquete,
    getModulosPaqueteById,
    getModulosPaqueteByCode,
    createModulosPaquete,
    updateModulosPaquete,
    deleteModulosPaquete
};