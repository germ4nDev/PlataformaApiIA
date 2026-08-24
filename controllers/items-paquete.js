/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Error Handling
*/
const { response } = require("express");
const ItemPaqueteService = require("../services/items-paquete.service");

const service = new ItemPaqueteService();

const getItemsPaquete = async (req, res = response) => {
    try {
        const items = await service.getItemsPaquete();
        return res.status(200).json({ ok: true, items });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            ok: false,
            msg: error.msg || "Error interno al obtener los items del paquete."
        });
    }
};

const getItemsByPaqueteCode = async (req, res = response) => {
    try {
        const { codigoPaquete } = req.params;
        const items = await service.getItemsPaquetePorCodigoPaquete(codigoPaquete);
        return res.status(200).json({ ok: true, items });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al obtener los items por código de paquete."
        });
    }
};

const getItemPaqueteById = async (req, res = response) => {
    try {
        const { id } = req.params;
        const item = await service.getItemPaquetePorId(id);
        return res.status(200).json({ ok: true, item });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al obtener el item solicitado."
        });
    }
};

const createItemPaquete = async (req, res = response) => {
    try {
        // QPLUS: Inyección de contexto de auditoría
        const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';
        const dataDTO = { ...req.body, codigoUsuario: usuarioAccion };

        const item = await service.createItemPaquete(dataDTO);
        return res.status(201).json({ ok: true, item });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al crear el item del paquete."
        });
    }
};

const updateItemPaquete = async (req, res = response) => {
    try {
        const { id } = req.params;

        // QPLUS: Hidratación del payload de auditoría
        const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';
        const dataDTO = { ...req.body, codigoUsuario: usuarioAccion };

        const item = await service.updateItemPaquete(id, dataDTO);
        return res.status(200).json({ ok: true, item });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al actualizar el item del paquete."
        });
    }
};

const deleteItemPaquete = async (req, res = response) => {
    try {
        const { id } = req.params;
        await service.deleteItemPaquete(id);

        return res.status(200).json({
            ok: true,
            msg: "Item de paquete eliminado correctamente."
        });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al eliminar el item del paquete."
        });
    }
};

module.exports = {
    getItemsPaquete,
    getItemPaqueteById,
    getItemsByPaqueteCode,
    createItemPaquete,
    updateItemPaquete,
    deleteItemPaquete
};