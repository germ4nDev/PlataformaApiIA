/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Error Handling
*/
const { response } = require("express");
const UploadsService = require("../services/uploads.service");

const service = new UploadsService();

const createFolder = async (req, res = response) => {
    try {
        const { fld } = req.body;

        console.log('crear folder', fld);

        const resultado = await service.createFolder(fld);

        return res.status(200).json({
            ok: true,
            respuesta: { msg: resultado }
        });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            ok: false,
            msg: error.msg || "Error al limpiar la carpeta."
        });
    }
};

const uploadResource = async (req, res = response) => {
    try {
        const { suc, type, usu } = req.params;
        // const usuarioAccion = usu || 'SISTEMA'; // (Lo puedes usar luego para logs de BD)

        if (!req.files || Object.keys(req.files).length === 0 || !req.files.file) {
            return res.status(400).json({
                ok: false,
                msg: "No se encontró ningún archivo en la petición (llave 'file' faltante)."
            });
        }

        const archivoSubido = req.files.file;

        const fileName = await service.uploadFile(archivoSubido, suc, type);

        return res.status(201).json({
            ok: true,
            respuesta: {
                msg: "Archivo almacenado y optimizado exitosamente.",
                fileName
            }
        });
    } catch (error) {
        console.error('Error en uploadResource:', error);
        return res.status(error.statusCode || 500).json({
            ok: false,
            msg: error.msg || "Error interno al subir el archivo."
        });
    }
};

const showResource = async (req, res = response) => {
    try {
        const { suc, type, fileName } = req.params;
        const pathFile = await service.getFilePath(suc, type, fileName);

        return res.sendFile(pathFile);
    } catch (error) {
        return res.status(error.statusCode || 404).json({
            ok: false,
            msg: error.msg || "Recurso no encontrado."
        });
    }
};

const deleteResource = async (req, res = response) => {
    try {
        const { suc, type, usu, fileName } = req.params;
        const usuarioAccion = usu || 'SISTEMA';

        await service.deleteFile(suc, type, fileName, usuarioAccion);

        return res.status(200).json({
            ok: true,
            respuesta: { msg: "Archivo eliminado correctamente." }
        });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            ok: false,
            msg: error.msg || "Error al eliminar el archivo."
        });
    }
};

const clearCategoryFolder = async (req, res = response) => {
    try {
        const { suc, type, usu } = req.params;
        const usuarioAccion = usu || 'SISTEMA';

        const resultado = await service.deleteFolderContent(suc, type, usuarioAccion);

        return res.status(200).json({
            ok: true,
            respuesta: { msg: resultado }
        });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            ok: false,
            msg: error.msg || "Error al limpiar la carpeta."
        });
    }
};

module.exports = {
    createFolder,
    uploadResource,
    showResource,
    deleteResource,
    clearCategoryFolder
};