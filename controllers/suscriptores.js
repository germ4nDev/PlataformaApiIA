/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Audit Standards
*/
const { response } = require("express");
const SuscriptoresService = require("../services/suscriptores.service");

const service = new SuscriptoresService();

const getSuscriptores = async (req, res = response) => {
  try {
    const suscriptores = await service.getSuscriptores();
    return res.status(200).json({ ok: true, suscriptores });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error interno al obtener los suscriptores."
    });
  }
};

const getSuscriptorById = async (req, res = response) => {
  try {
    const { id } = req.params;
    const suscriptor = await service.getSuscriptorById(id);
    return res.status(200).json({ ok: true, suscriptor });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al obtener el suscriptor solicitado."
    });
  }
};

const createSuscriptor = async (req, res = response) => {
  try {
    // QPLUS: Inyección de auditoría
    const dataDTO = { ...req.body };

    const suscriptor = await service.createSuscriptor(dataDTO);
    return res.status(201).json({ ok: true, suscriptor });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al crear el suscriptor."
    });
  }
};

const updateSuscriptor = async (req, res = response) => {
  try {
    const { id } = req.params;

    // QPLUS: Hidratación del payload de auditoría
    const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';
    const dataDTO = { ...req.body, codigoUsuario: usuarioAccion };

    const suscriptor = await service.updateSuscriptor(id, dataDTO);
    return res.status(200).json({ ok: true, suscriptor });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al actualizar el suscriptor."
    });
  }
};

const deleteSuscriptor = async (req, res = response) => {
  try {
    const { id } = req.params;
    await service.deleteSuscriptor(id);

    return res.status(200).json({
      ok: true,
      msg: "Suscriptor eliminado correctamente."
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al eliminar el suscriptor."
    });
  }
};

module.exports = {
  getSuscriptores,
  getSuscriptorById,
  createSuscriptor,
  updateSuscriptor,
  deleteSuscriptor
};