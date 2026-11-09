/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Error Handling
*/
const { response } = require("express");
const TipoGaleriaService = require("../services/tipos-galeria.service");

const service = new TipoGaleriaService();

const getTiposGaleria = async (req, res = response) => {
    try {
        const tiposGaleria = await service.getTiposGaleria();
        return res.status(200).json({ ok: true, tiposGaleria });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            ok: false,
            msg: error.msg || "Error interno al obtener los tiposGaleria de galería.",
            errores: error.details // CC-137: detalle del Joi
        });
    }
};

const getTipoGaleriaById = async (req, res = response) => {
    try {
        const { id } = req.params;
        const tipoGaleria = await service.getTipoGaleriaById(id);
        return res.status(200).json({ ok: true, tipoGaleria });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al obtener el tipoGaleria de galería solicitado.",
            errores: error.details // CC-137: detalle del Joi
        });
    }
};

const createTipoGaleria = async (req, res = response) => {
    try {
        // QPLUS: Inyección de auditoría
        const usuarioAccion = req.codigoUsuario || 'SISTEMA'; // CC-137: del token (validarJWT)
        const dataDTO = { ...req.body, codigoUsuarioCreacion: usuarioAccion, codigoUsuarioModificacion: usuarioAccion };

        const tipoGaleria = await service.createTipoGaleria(dataDTO);
        return res.status(201).json({ ok: true, tipoGaleria });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al crear el tipoGaleria de galería.",
            errores: error.details // CC-137: detalle del Joi
        });
    }
};

const updateTipoGaleria = async (req, res = response) => {
    try {
        const { id } = req.params;

        // QPLUS: Hidratación del payload de auditoría
        const usuarioAccion = req.codigoUsuario || 'SISTEMA'; // CC-137: del token (validarJWT)
        const dataDTO = { ...req.body, codigoUsuarioModificacion: usuarioAccion };

        const tipoGaleria = await service.updateTipoGaleria(id, dataDTO);
        return res.status(200).json({ ok: true, tipoGaleria });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al actualizar el tipoGaleria de galería.",
            errores: error.details // CC-137: detalle del Joi
        });
    }
};

const deleteTipoGaleria = async (req, res = response) => {
    try {
        const { id } = req.params;
        await service.deleteTipoGaleria(id);

        return res.status(200).json({
            ok: true,
            msg: "Tipo de galería eliminado correctamente."
        });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al eliminar el tipo de galería.",
            errores: error.details // CC-137: detalle del Joi
        });
    }
};

module.exports = {
    getTiposGaleria,
    getTipoGaleriaById,
    createTipoGaleria,
    updateTipoGaleria,
    deleteTipoGaleria
};