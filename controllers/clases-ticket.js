/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Error Handling
*/
const { response } = require("express");
const ClasesTicketService = require("../services/clases-ticlet.service");

const service = new ClasesTicketService();

const getClasesTickets = async (req, res = response) => {
  try {
    const clasesTicket = await service.obtenerClasesTicket();
    return res.status(200).json({ ok: true, clasesTicket });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error interno al obtener clases de ticket.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

const getClaseTicketById = async (req, res = response) => {
  try {
    const { id } = req.params;
    const claseTicket = await service.obtenerClaseTicketPorId(id);
    return res.status(200).json({ ok: true, claseTicket });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al obtener la clase de ticket.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

const createClaseTicket = async (req, res = response) => {
  try {
    // QPLUS: Inyección de auditoría para el DTO
    const usuarioAccion = req.codigoUsuario || 'SISTEMA'; // CC-137: del token (validarJWT)
    const dataDTO = { ...req.body, codigoUsuarioCreacion: usuarioAccion, codigoUsuarioModificacion: usuarioAccion };

    const claseTicket = await service.crearClaseTicket(dataDTO);
    return res.status(201).json({ ok: true, claseTicket });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al crear la clase de ticket.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

const updateClaseTicket = async (req, res = response) => {
  try {
    const { id } = req.params;

    // QPLUS: Hidratación del payload de auditoría
    const usuarioAccion = req.codigoUsuario || 'SISTEMA'; // CC-137: del token (validarJWT)
    const dataDTO = { ...req.body, codigoUsuarioModificacion: usuarioAccion };

    const claseTicket = await service.actualizarClaseTicket(id, dataDTO);
    return res.status(200).json({ ok: true, claseTicket });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al actualizar la clase de ticket.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

const deleteClaseTicket = async (req, res = response) => {
  try {
    const { id } = req.params;
    await service.eliminarClaseTicket(id);
    return res.status(200).json({ ok: true, msg: "Registro eliminado correctamente." });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al eliminar la clase de ticket.",
      errores: error.details // CC-137: detalle del Joi
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