/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Error Handling
*/
const { response } = require("express");
const EstadoService = require("../services/estados.service");

const service = new EstadoService();

const getEstados = async (req, res = response) => {
  try {
    const estados = await service.getEstados();
    return res.status(200).json({ ok: true, estados });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error interno al obtener los estados."
    });
  }
};

const getEstadoById = async (req, res = response) => {
  try {
    const { id } = req.params;
    const estado = await service.getEstadoPorId(id);
    return res.status(200).json({ ok: true, estado });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al obtener el estado solicitado."
    });
  }
};

const createEstado = async (req, res = response) => {
  try {
    // QPLUS: Inyección de auditoría para trazabilidad
    const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';
    const dataDTO = { ...req.body, codigoUsuario: usuarioAccion };

    const estado = await service.createEstado(dataDTO);
    return res.status(201).json({ ok: true, estado });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al crear el estado."
    });
  }
};

const updateEstado = async (req, res = response) => {
  try {
    const { id } = req.params;

    // QPLUS: Hidratación del payload de auditoría
    const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';
    const dataDTO = { ...req.body, codigoUsuario: usuarioAccion };

    const estado = await service.updateEstado(id, dataDTO);
    return res.status(200).json({ ok: true, estado });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al actualizar el estado."
    });
  }
};

const deleteEstado = async (req, res = response) => {
  try {
    const { id } = req.params;
    await service.deleteEstado(id);

    return res.status(200).json({
      ok: true,
      msg: "Estado eliminado correctamente."
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al eliminar el estado."
    });
  }
};

module.exports = {
  getEstados,
  getEstadoById,
  createEstado,
  updateEstado,
  deleteEstado
};