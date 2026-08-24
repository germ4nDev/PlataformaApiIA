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
            msg: error.msg || "Error interno al obtener bibliotecas."
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
            msg: error.msg || "Error al obtener la biblioteca."
        });
    }
};

const createBiblioteca = async (req, res = response) => {
    try {
        // QPLUS: Inyección de contexto de auditoría
        const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';
        const dataDTO = { ...req.body, codigoUsuario: usuarioAccion };

        const bibliotecaDB = await service.createBiblioteca(dataDTO);

        return res.status(201).json({ ok: true, bibliotecaDB });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al crear la biblioteca."
        });
    }
};

const updateBiblioteca = async (req, res = response) => {
    try {
        const { codigoBiblioteca, ...data } = req.body;

        // QPLUS: Hidratación del payload de auditoría
        const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';
        const dataDTO = { ...data, codigoUsuario: usuarioAccion };

        const bibliotecaActualizada = await service.updateBiblioteca(codigoBiblioteca, dataDTO);

        return res.status(200).json({ ok: true, bibliotecaActualizada });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al actualizar la biblioteca."
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
            msg: error.msg || "Error al eliminar la biblioteca."
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