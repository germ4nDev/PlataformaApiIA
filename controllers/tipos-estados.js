/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Audit Standards
*/
const { response } = require("express");
const TipoEstadoService = require("../services/tipos-estados.service");

const service = new TipoEstadoService();

const getTiposEstados = async (req, res = response) => {
  try {
    const tipos = await service.getTiposEstados();
    return res.status(200).json({ ok: true, tipos });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error interno al obtener los tipos de estado."
    });
  }
};

const getTipoEstadoById = async (req, res = response) => {
  try {
    const { id } = req.params;
    const tipo = await service.getTipoEstadoById(id);
    return res.status(200).json({ ok: true, tipo });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al obtener el tipo de estado solicitado."
    });
  }
};

const createTipoEstado = async (req, res = response) => {
  try {
    // QPLUS: Inyección de auditoría
    const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';
    const dataDTO = { ...req.body, codigoUsuario: usuarioAccion };

    const tipo = await service.createTipoEstado(dataDTO);
    return res.status(201).json({ ok: true, tipo });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al crear el tipo de estado."
    });
  }
};

const updateTipoEstado = async (req, res = response) => {
  try {
    const { id } = req.params;

    // QPLUS: Hidratación del payload de auditoría
    const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';
    const dataDTO = { ...req.body, codigoUsuario: usuarioAccion };

    const tipo = await service.updateTipoEstado(id, dataDTO);
    return res.status(200).json({ ok: true, tipo });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al actualizar el tipo de estado."
    });
  }
};

const deleteTipoEstado = async (req, res = response) => {
  try {
    const { id } = req.params;
    await service.deleteTipoEstado(id);

    return res.status(200).json({
      ok: true,
      msg: "Tipo de estado eliminado correctamente."
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al eliminar el tipo de estado."
    });
  }
};

module.exports = {
  getTiposEstados,
  getTipoEstadoById,
  createTipoEstado,
  updateTipoEstado,
  deleteTipoEstado
};