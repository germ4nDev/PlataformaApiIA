/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Error Handling
*/
const { response } = require("express");
const RequerimientosService = require("../services/requerimientos-tk.service");

const service = new RequerimientosService();

const getRequerimientos = async (req, res = response) => {
  try {
    const requerimientos = await service.getRequerimientos();
    return res.status(200).json({ ok: true, requerimientos });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error interno al obtener los requerimientos."
    });
  }
};

const getRequerimientoById = async (req, res = response) => {
  try {
    const { id } = req.params;
    const requerimiento = await service.getRequerimientoById(id);
    return res.status(200).json({ ok: true, requerimiento });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al obtener el requerimiento solicitado."
    });
  }
};

const createRequerimiento = async (req, res = response) => {
  try {
    // QPLUS: Inyección de auditoría
    const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';
    const dataDTO = { ...req.body, codigoUsuario: usuarioAccion };

    const requerimiento = await service.createRequerimiento(dataDTO);
    return res.status(201).json({ ok: true, requerimiento });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al crear el requerimiento."
    });
  }
};

const updateRequerimiento = async (req, res = response) => {
  try {
    const { id } = req.params;

    // QPLUS: Hidratación del payload de auditoría
    const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';
    const dataDTO = { ...req.body, codigoUsuario: usuarioAccion };

    const requerimiento = await service.updateRequerimiento(id, dataDTO);
    return res.status(200).json({ ok: true, requerimiento });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al actualizar el requerimiento."
    });
  }
};

const deleteRequerimiento = async (req, res = response) => {
  try {
    const { id } = req.params;
    await service.deleteRequerimiento(id);

    return res.status(200).json({
      ok: true,
      msg: "Requerimiento eliminado correctamente."
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al eliminar el requerimiento."
    });
  }
};

module.exports = {
  getRequerimientos,
  getRequerimientoById,
  createRequerimiento,
  updateRequerimiento,
  deleteRequerimiento
};