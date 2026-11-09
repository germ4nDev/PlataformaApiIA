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
            msg: error.msg || "Error interno al obtener los items del paquete.",
            errores: error.details // CC-137: detalle del Joi
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
            msg: error.msg || "Error al obtener los items por código de paquete.",
            errores: error.details // CC-137: detalle del Joi
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
            msg: error.msg || "Error al obtener el item solicitado.",
            errores: error.details // CC-137: detalle del Joi
        });
    }
};

const createItemPaquete = async (req, res = response) => {
    try {
        // QPLUS: Inyección de contexto de auditoría
        const usuarioAccion = req.codigoUsuario || 'SISTEMA'; // CC-137: del token (validarJWT)
        const dataDTO = { ...req.body, codigoUsuarioCreacion: usuarioAccion, codigoUsuarioModificacion: usuarioAccion };

        const item = await service.createItemPaquete(dataDTO);
        return res.status(201).json({ ok: true, item });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al crear el item del paquete.",
            errores: error.details // CC-137: detalle del Joi
        });
    }
};

const updateItemPaquete = async (req, res = response) => {
    try {
        const { id } = req.params;

        // QPLUS: Hidratación del payload de auditoría
        const usuarioAccion = req.codigoUsuario || 'SISTEMA'; // CC-137: del token (validarJWT)
        const dataDTO = { ...req.body, codigoUsuarioModificacion: usuarioAccion };

        const item = await service.updateItemPaquete(id, dataDTO);
        return res.status(200).json({ ok: true, item });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al actualizar el item del paquete.",
            errores: error.details // CC-137: detalle del Joi
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
            msg: error.msg || "Error al eliminar el item del paquete.",
            errores: error.details // CC-137: detalle del Joi
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