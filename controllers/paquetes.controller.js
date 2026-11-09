/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Error Handling
*/
const { response } = require("express");
const PaqueteService = require("../services/paquetes.service");

const service = new PaqueteService();

const getPaquetes = async (req, res = response) => {
    try {
        const paquetes = await service.getPaquetes();
        return res.status(200).json({ ok: true, paquetes });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            ok: false,
            msg: error.msg || "Error interno al obtener los paquetes.",
            errores: error.details // CC-137: detalle del Joi
        });
    }
};

const getPaqueteById = async (req, res = response) => {
    try {
        const { id } = req.params;
        const paquete = await service.getPaqueteById(id);
        return res.status(200).json({ ok: true, paquete });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al obtener el paquete solicitado.",
            errores: error.details // CC-137: detalle del Joi
        });
    }
};

const createPaquete = async (req, res = response) => {
    try {
        const dataDTO = { ...req.body };

        const paquete = await service.createPaquete(dataDTO);
        return res.status(201).json({ ok: true, paquete });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al crear el paquete.",
            errores: error.details // CC-137: detalle del Joi
        });
    }
};

const updatePaquete = async (req, res = response) => {
    try {
        const { id } = req.params;

        // QPLUS: Hidratación del payload de auditoría
        const usuarioAccion = req.codigoUsuario || 'SISTEMA'; // CC-137: del token (validarJWT)
        const dataDTO = { ...req.body, codigoUsuarioModificacion: usuarioAccion };

        const paquete = await service.updatePaquete(id, dataDTO);
        return res.status(200).json({ ok: true, paquete });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al actualizar el paquete.",
            errores: error.details // CC-137: detalle del Joi
        });
    }
};

const deletePaquete = async (req, res = response) => {
    try {
        const { id } = req.params;
        await service.deletePaquete(id);

        return res.status(200).json({
            ok: true,
            msg: "Paquete eliminado correctamente."
        });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al eliminar el paquete.",
            errores: error.details // CC-137: detalle del Joi
        });
    }
};

module.exports = {
    getPaquetes,
    getPaqueteById,
    createPaquete,
    updatePaquete,
    deletePaquete
};