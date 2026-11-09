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
            msg: error.msg || "Error interno al obtener los formatos de galería.",
            errores: error.details // CC-137: detalle del Joi
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
            msg: error.msg || "Error al obtener el formato solicitado.",
            errores: error.details // CC-137: detalle del Joi
        });
    }
};

const createFormatoGaleria = async (req, res = response) => {
    try {
        // QPLUS: Inyección de auditoría
        const usuarioAccion = req.codigoUsuario || 'SISTEMA'; // CC-137: del token (validarJWT)
        const dataDTO = { ...req.body, codigoUsuarioCreacion: usuarioAccion, codigoUsuarioModificacion: usuarioAccion };

        const formatoGaleria = await service.createFormatoGaleria(dataDTO);
        return res.status(201).json({ ok: true, formatoGaleria });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al crear el formato de galería.",
            errores: error.details // CC-137: detalle del Joi
        });
    }
};

const updateFormatoGaleria = async (req, res = response) => {
    try {
        const { id } = req.params;

        // QPLUS: Hidratación del payload de auditoría
        const usuarioAccion = req.codigoUsuario || 'SISTEMA'; // CC-137: del token (validarJWT)
        const dataDTO = { ...req.body, codigoUsuarioModificacion: usuarioAccion };

        const formatoGaleria = await service.updateFormatoGaleria(id, dataDTO);
        return res.status(200).json({ ok: true, formatoGaleria });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al actualizar el formato de galería.",
            errores: error.details // CC-137: detalle del Joi
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
            msg: error.msg || "Error al eliminar el formato de galería.",
            errores: error.details // CC-137: detalle del Joi
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