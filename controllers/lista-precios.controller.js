const { response } = require("express");
const ListaPreciosService = require('../services/lista-precios.service');

const service = new ListaPreciosService();

const getListas = async (req, res) => {
    try {
        const listas = await service.getListasPrecios();
        res.status(200).json({ ok: true, data: listas });
    } catch (error) {
        res.status(error.statusCode || 500).json({
            ok: false,
            msg: error.msg || 'Error al obtener las listas de precios.',
            error: error.details || error.message
        });
    }
};

const createLista = async (req, res) => {
    try {
        const payload = req.body;
        // Asignamos el usuario que hace la petición (Asumiendo que pasa por un middleware de auth)
        if (req.user) payload.codigoUsuarioCreacion = req.user.codigoUsuario;

        const nuevaLista = await service.createListaCompleta(payload);
        res.status(201).json({ ok: true, msg: 'Lista de precios creada exitosamente.', data: nuevaLista });
    } catch (error) {
        res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || 'Error de validación al crear la lista.',
            error: error.details || error.message
        });
    }
};

const updateLista = async (req, res) => {
    try {
        const { id } = req.params;
        const payload = req.body;
        if (req.user) payload.codigoUsuarioModificacion = req.user.codigoUsuario;

        const listaActualizada = await service.updateLista(id, payload);
        res.status(200).json({ ok: true, msg: 'Lista actualizada exitosamente.', data: listaActualizada });
    } catch (error) {
        res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || 'Error al actualizar la lista.',
            error: error.details || error.message
        });
    }


};

// ==========================================
// 🟢 CONTROLADORES PARA EL DETALLE
// ==========================================

const addDetalle = async (req, res) => {
    try {
        const { codigoLista } = req.params; // La lista a la que le agregamos el precio
        const payload = req.body;
        if (req.user) payload.codigoUsuarioCreacion = req.user.codigoUsuario;

        const nuevoDetalle = await service.addDetalle(codigoLista, payload);
        res.status(201).json({ ok: true, msg: 'Precio agregado a la lista exitosamente.', data: nuevoDetalle });
    } catch (error) {
        res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || 'Error al agregar el detalle de precio.',
            error: error.details || error.message
        });
    }
};

const updateDetalle = async (req, res) => {
    try {
        const { codigoDetalle } = req.params;
        const payload = req.body;
        if (req.user) payload.codigoUsuarioModificacion = req.user.codigoUsuario;

        const detalleActualizado = await service.updateDetalle(codigoDetalle, payload);
        res.status(200).json({ ok: true, msg: 'Precio actualizado exitosamente.', data: detalleActualizado });
    } catch (error) {
        res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || 'Error al actualizar el detalle de precio.',
            error: error.details || error.message
        });
    }
};

const deleteDetalle = async (req, res) => {
    try {
        const { codigoDetalle } = req.params;
        await service.deleteDetalle(codigoDetalle);
        res.status(200).json({ ok: true, msg: 'Precio eliminado de la lista exitosamente.' });
    } catch (error) {
        res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || 'Error al eliminar el precio.',
            error: error.details || error.message
        });
    }
};

module.exports = {
    getListas,
    createLista,
    updateLista,
    addDetalle,     // <--- Nuevo
    updateDetalle,  // <--- Nuevo
    deleteDetalle   // <--- Nuevo
};