/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Error Handling
*/
const { response } = require("express");
const FormatoGaleriaService = require("../services/formatos-galeria.service");

const service = new FormatoGaleriaService();

const getFormatosGaleria = async (req, res = response) => {
    try {
        const formatosGaleria = await service.getFormatosGaleria();
        return res.status(200).json({ ok: true, formatosGaleria });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            ok: false,
            msg: error.msg || "Error interno al obtener los formatos de galería."
        });
    }
};

const getFormatoGaleriaById = async (req, res = response) => {
    try {
        const { id } = req.params;
        const formatoGaleria = await service.getFormatoGaleriaPorId(id);
        return res.status(200).json({ ok: true, formatoGaleria });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al obtener el formato solicitado."
        });
    }
};

const createFormatoGaleria = async (req, res = response) => {
    try {
        // QPLUS: Inyección de auditoría
        const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';
        const dataDTO = { ...req.body, codigoUsuario: usuarioAccion };

        const formatoGaleria = await service.createFormatoGaleria(dataDTO);
        return res.status(201).json({ ok: true, formatoGaleria });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al crear el formato de galería."
        });
    }
};

const updateFormatoGaleria = async (req, res = response) => {
    try {
        const { id } = req.params;

        // QPLUS: Hidratación del payload de auditoría
        const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';
        const dataDTO = { ...req.body, codigoUsuario: usuarioAccion };

        const formatoGaleria = await service.updateFormatoGaleria(id, dataDTO);
        return res.status(200).json({ ok: true, formatoGaleria });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al actualizar el formato de galería."
        });
    }
};

const deleteFormatoGaleria = async (req, res = response) => {
    try {
        const { id } = req.params;
        await service.deleteFormatoGaleria(id);

        return res.status(200).json({
            ok: true,
            msg: "Formato eliminado correctamente."
        });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al eliminar el formato de galería."
        });
    }
};

module.exports = {
    getFormatosGaleria,
    getFormatoGaleriaById,
    createFormatoGaleria,
    updateFormatoGaleria,
    deleteFormatoGaleria
};