/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Error Handling
*/
const { response } = require("express");
const GaleriasService = require("../services/galerias.service");

const service = new GaleriasService();

const getGalerias = async (req, res = response) => {
    try {
        const galerias = await service.getGalerias();
        return res.status(200).json({ ok: true, galerias });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            ok: false,
            msg: error.msg || "Error interno al obtener las galerías."
        });
    }
};

const getGaleriaById = async (req, res = response) => {
    try {
        const { id } = req.params;
        const galeria = await service.getGaleriaPorId(id);
        return res.status(200).json({ ok: true, galeria });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al obtener la galería solicitada."
        });
    }
};

const createGaleria = async (req, res = response) => {
    try {
        // QPLUS: Inyección de auditoría
        const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';
        const dataDTO = { ...req.body, codigoUsuario: usuarioAccion };

        const galeria = await service.createGaleria(dataDTO);
        return res.status(201).json({ ok: true, galeria });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al crear la galería."
        });
    }
};

const updateGaleria = async (req, res = response) => {
    try {
        const { id } = req.params;

        // QPLUS: Hidratación del payload de auditoría
        const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';
        const dataDTO = { ...req.body, codigoUsuario: usuarioAccion };

        const galeria = await service.updateGaleria(id, dataDTO);
        return res.status(200).json({ ok: true, galeria });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al actualizar la galería."
        });
    }
};

const deleteGaleria = async (req, res = response) => {
    try {
        const { id } = req.params;
        await service.deleteGaleria(id);

        return res.status(200).json({
            ok: true,
            msg: "Galería eliminada correctamente."
        });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al eliminar la galería."
        });
    }
};

module.exports = {
    getGalerias,
    getGaleriaById,
    createGaleria,
    updateGaleria,
    deleteGaleria
};