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
            msg: error.msg || "Error interno al obtener los tickets."
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
            msg: error.msg || "Error al obtener el ticket solicitado."
        });
    }
};

const createTicket = async (req, res = response) => {
    try {
        // QPLUS: Inyección de auditoría para trazabilidad del ticket
        const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';
        const dataDTO = { ...req.body, codigoUsuario: usuarioAccion };

        const ticket = await service.createTicket(dataDTO);
        return res.status(201).json({ ok: true, ticket });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al crear el ticket."
        });
    }
};

const updateTicket = async (req, res = response) => {
    try {
        const { id } = req.params;

        // QPLUS: Hidratación del payload de auditoría
        const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';
        const dataDTO = { ...req.body, codigoUsuario: usuarioAccion };

        const ticket = await service.updateTicket(id, dataDTO);
        return res.status(200).json({ ok: true, ticket });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al actualizar el ticket."
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
            msg: error.msg || "Error al eliminar el ticket."
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