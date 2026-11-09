/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Error Handling
*/
const { response } = require("express");
const TicketAPService = require("../services/tickets-ap.service");

const service = new TicketAPService();

const getTickets = async (req, res = response) => {
    try {
        const tickets = await service.getTickets();
        return res.status(200).json({ ok: true, tickets });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            ok: false,
            msg: error.msg || "Error interno al obtener los tickets.",
            errores: error.details // CC-137: detalle del Joi
        });
    }
};

const getTicketById = async (req, res = response) => {
    try {
        const { id } = req.params;
        const ticket = await service.getTicketById(id);
        return res.status(200).json({ ok: true, ticket });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al obtener el ticket solicitado.",
            errores: error.details // CC-137: detalle del Joi
        });
    }
};

const createTicket = async (req, res = response) => {
    try {
        // QPLUS: Inyección de auditoría para trazabilidad del ticket
        const usuarioAccion = req.codigoUsuario || 'SISTEMA'; // CC-137: del token (validarJWT)
        const dataDTO = { ...req.body, codigoUsuarioCreacion: usuarioAccion, codigoUsuarioModificacion: usuarioAccion };

        const ticket = await service.createTicket(dataDTO);
        return res.status(201).json({ ok: true, ticket });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al crear el ticket.",
            errores: error.details // CC-137: detalle del Joi
        });
    }
};

const updateTicket = async (req, res = response) => {
    try {
        const { id } = req.params;

        // QPLUS: Hidratación del payload de auditoría
        const usuarioAccion = req.codigoUsuario || 'SISTEMA'; // CC-137: del token (validarJWT)
        const dataDTO = { ...req.body, codigoUsuarioModificacion: usuarioAccion };

        const ticket = await service.updateTicket(id, dataDTO);
        return res.status(200).json({ ok: true, ticket });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al actualizar el ticket.",
            errores: error.details // CC-137: detalle del Joi
        });
    }
};

const deleteTicket = async (req, res = response) => {
    try {
        const { id } = req.params;
        await service.deleteTicket(id);

        return res.status(200).json({
            ok: true,
            msg: "Ticket eliminado correctamente."
        });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al eliminar el ticket.",
            errores: error.details // CC-137: detalle del Joi
        });
    }
};

module.exports = {
    getTickets,
    getTicketById,
    createTicket,
    updateTicket,
    deleteTicket
};