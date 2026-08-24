/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Error Handling
*/
const { response } = require("express");
const ClasesTicketService = require("../services/clases-ticlet.service");

const service = new ClasesTicketService();

const getClasesTickets = async (req, res = response) => {
  try {
    const clasesTicket = await service.getClasesTicket();
    return res.status(200).json({ ok: true, clasesTicket });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error interno al obtener clases de ticket."
    });
  }
};

const getClaseTicketById = async (req, res = response) => {
  try {
    const { id } = req.params;
    const claseTicket = await service.getClaseTicketPorId(id);
    return res.status(200).json({ ok: true, claseTicket });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al obtener la clase de ticket."
    });
  }
};

const createClaseTicket = async (req, res = response) => {
  try {
    // QPLUS: Inyección de auditoría para el DTO
    const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';
    const dataDTO = { ...req.body, codigoUsuario: usuarioAccion };

    const claseTicket = await service.createClaseTicket(dataDTO);
    return res.status(201).json({ ok: true, claseTicket });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al crear la clase de ticket."
    });
  }
};

const updateClaseTicket = async (req, res = response) => {
  try {
    const { id } = req.params;

    // QPLUS: Hidratación del payload de auditoría
    const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';
    const dataDTO = { ...req.body, codigoUsuario: usuarioAccion };

    const claseTicket = await service.updateClaseTicket(id, dataDTO);
    return res.status(200).json({ ok: true, claseTicket });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al actualizar la clase de ticket."
    });
  }
};

const deleteClaseTicket = async (req, res = response) => {
  try {
    const { id } = req.params;
    await service.deleteClaseTicket(id);
    return res.status(200).json({ ok: true, msg: "Registro eliminado correctamente." });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al eliminar la clase de ticket."
    });
  }
};

module.exports = {
  getClasesTickets,
  getClaseTicketById,
  createClaseTicket,
  updateClaseTicket,
  deleteClaseTicket
};