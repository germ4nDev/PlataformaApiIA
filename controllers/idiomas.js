/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Error Handling
*/
const { response } = require("express");
const IdiomaService = require("../services/idiomas.service");

const service = new IdiomaService();

const getIdiomas = async (req, res = response) => {
    try {
        const idiomas = await service.getIdiomas();
        return res.status(200).json({ ok: true, idiomas });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            ok: false,
            msg: error.msg || "Error interno al obtener los idiomas."
        });
    }
};

const getIdiomaById = async (req, res = response) => {
    try {
        const { id } = req.params;
        const idioma = await service.getIdiomaById(id);
        return res.status(200).json({ ok: true, idioma });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al obtener el idioma solicitado."
        });
    }
};

const createIdioma = async (req, res = response) => {
    try {
        // QPLUS: Inyección de auditoría
        const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';
        const dataDTO = { ...req.body, codigoUsuario: usuarioAccion };

        const idioma = await service.createIdioma(dataDTO);
        return res.status(201).json({ ok: true, idioma });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al crear el idioma."
        });
    }
};

const updateIdioma = async (req, res = response) => {
    try {
        const { id } = req.params;

        // QPLUS: Hidratación del payload
        const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';
        const dataDTO = { ...req.body, codigoUsuario: usuarioAccion };

        const idioma = await service.updateIdioma(id, dataDTO);
        return res.status(200).json({ ok: true, idioma });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al actualizar el idioma."
        });
    }
};

const deleteIdioma = async (req, res = response) => {
    try {
        const { id } = req.params;
        await service.deleteIdioma(id);

        return res.status(200).json({
            ok: true,
            msg: "Idioma eliminado correctamente."
        });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al eliminar el idioma."
        });
    }
};

module.exports = {
    getIdiomas,
    getIdiomaById,
    createIdioma,
    updateIdioma,
    deleteIdioma
};