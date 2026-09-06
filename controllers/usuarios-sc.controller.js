/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Audit Standards
*/
const { response } = require("express");
const UsuarioSCService = require("../services/usuarios-sc.service");

const service = new UsuarioSCService();

const getUsuariosSC = async (req, res = response) => {
    try {
        const usuariosSC = await service.getUsuariosSC();
        return res.status(200).json({ ok: true, usuariosSC });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            ok: false,
            msg: error.msg || "Error interno al obtener los usuariosSC suscriptores."
        });
    }
};

const getUsuarioSCById = async (req, res = response) => {
    try {
        const { id } = req.params;
        const usuarioSC = await service.getUsuarioSCById(id);
        return res.status(200).json({ ok: true, usuarioSC });
    } catch (error) {
        return res.status(error.statusCode || 404).json({
            ok: false,
            msg: error.msg || "Error al obtener el usuarioSC suscriptor solicitado."
        });
    }
};

const getUsuariosSCBySuscriptorCode = async (req, res = response) => {
    try {
        const { codigoSuscriptor } = req.params;
        const usuariosSC = await service.getUsuariosSCBySuscriptorCode(codigoSuscriptor);
        return res.status(200).json({ ok: true, usuariosSC });
    } catch (error) {
        return res.status(error.statusCode || 404).json({
            ok: false,
            msg: error.msg || "Error al obtener usuariosSC por código de suscriptor."
        });
    }
};

const createUsuarioSC = async (req, res = response) => {
    try {
        const dataDTO = { ...req.body };

        const usuarioSC = await service.createUsuarioSC(dataDTO);
        return res.status(201).json({ ok: true, usuarioSC });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al crear el usuarioSC suscriptor."
        });
    }
};

const updateUsuarioSC = async (req, res = response) => {
    try {
        const { id } = req.params;

        // QPLUS: Hidratación del payload de auditoría
        const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';
        const dataDTO = { ...req.body, codigoUsuario: usuarioAccion };

        const usuarioSC = await service.updateUsuarioSC(id, dataDTO);
        return res.status(200).json({ ok: true, usuarioSC });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al actualizar el usuarioSC suscriptor."
        });
    }
};

const deleteUsuarioSC = async (req, res = response) => {
    try {
        const { id } = req.params;
        await service.deleteUsuarioSC(id);

        return res.status(200).json({
            ok: true,
            msg: "Usuario suscriptor eliminado correctamente."
        });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al eliminar el usuario suscriptor."
        });
    }
};

module.exports = {
    getUsuariosSC,
    getUsuarioSCById,
    getUsuariosSCBySuscriptorCode,
    createUsuarioSC,
    updateUsuarioSC,
    deleteUsuarioSC
};