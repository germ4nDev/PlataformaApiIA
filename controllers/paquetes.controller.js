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
            msg: error.msg || "Error interno al obtener los paquetes."
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
            msg: error.msg || "Error al obtener el paquete solicitado."
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
            msg: error.msg || "Error al crear el paquete."
        });
    }
};

const updatePaquete = async (req, res = response) => {
    try {
        const { id } = req.params;

        // QPLUS: Hidratación del payload de auditoría
        const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';
        const dataDTO = { ...req.body, codigoUsuario: usuarioAccion };

        const paquete = await service.updatePaquete(id, dataDTO);
        return res.status(200).json({ ok: true, paquete });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al actualizar el paquete."
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
            msg: error.msg || "Error al eliminar el paquete."
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