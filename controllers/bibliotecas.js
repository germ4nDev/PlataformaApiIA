/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Error Handling
*/
const { response } = require("express");
const BibliotecasService = require("../services/bibliotecas.service");

const service = new BibliotecasService();

const getBibliotecas = async (req, res = response) => {
    try {
        const bibliotecas = await service.getBibliotecas();
        return res.status(200).json({ ok: true, bibliotecas });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            ok: false,
            msg: error.msg || "Error interno al obtener bibliotecas.",
            errores: error.details // CC-137: detalle del Joi
        });
    }
};

const getBibliotecaByCode = async (req, res = response) => {
    try {
        const { id } = req.params;
        const biblioteca = await service.getBibliotecaByCode(id);

        return res.status(200).json({ ok: true, biblioteca });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al obtener la biblioteca.",
            errores: error.details // CC-137: detalle del Joi
        });
    }
};

const createBiblioteca = async (req, res = response) => {
    try {
        // QPLUS: Inyección de contexto de auditoría
        const usuarioAccion = req.codigoUsuario || 'SISTEMA'; // CC-137: del token (validarJWT)
        const dataDTO = { ...req.body, codigoUsuarioCreacion: usuarioAccion, codigoUsuarioModificacion: usuarioAccion };

        const bibliotecaDB = await service.createBiblioteca(dataDTO);

        return res.status(201).json({ ok: true, bibliotecaDB });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al crear la biblioteca.",
            errores: error.details // CC-137: detalle del Joi
        });
    }
};

const updateBiblioteca = async (req, res = response) => {
    try {
        // CC-138: el DTO exige codigoBiblioteca; antes se quitaba del cuerpo (400). La ruta es PUT /:id
        const codigoBiblioteca = req.params.id || req.body.codigoBiblioteca;
        const data = { ...req.body, codigoBiblioteca };

        // QPLUS: Hidratación del payload de auditoría
        const usuarioAccion = req.codigoUsuario || 'SISTEMA'; // CC-137: del token (validarJWT)
        const dataDTO = { ...data, codigoUsuarioModificacion: usuarioAccion };

        const bibliotecaActualizada = await service.updateBiblioteca(codigoBiblioteca, dataDTO);

        return res.status(200).json({ ok: true, bibliotecaActualizada });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al actualizar la biblioteca.",
            errores: error.details // CC-137: detalle del Joi
        });
    }
};

const deleteBiblioteca = async (req, res = response) => {
    try {
        const { id } = req.params;
        await service.deleteBiblioteca(id);

        return res.status(200).json({
            ok: true,
            msg: "Biblioteca eliminada correctamente."
        });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al eliminar la biblioteca.",
            errores: error.details // CC-137: detalle del Joi
        });
    }
};

module.exports = {
    getBibliotecas,
    getBibliotecaByCode,
    createBiblioteca,
    updateBiblioteca,
    deleteBiblioteca,
};