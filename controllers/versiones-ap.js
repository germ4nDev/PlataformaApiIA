/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Audit Standards
*/
const { response } = require("express");
const VersionesAPService = require("../services/versiones-ap.service");

const service = new VersionesAPService();

const getVersionesAP = async (req, res = response) => {
  try {
    const versiones = await service.getVersionesAP();
    return res.status(200).json({ ok: true, versiones });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error interno al obtener las versiones AP."
    });
  }
};

const getVersionAPById = async (req, res = response) => {
  try {
    const { id } = req.params;
    const version = await service.getVersionAPById(id);
    return res.status(200).json({ ok: true, version });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al obtener la versión AP solicitada."
    });
  }
};

const createVersionAP = async (req, res = response) => {
  try {
    // QPLUS: Inyección de auditoría
    const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';
    const dataDTO = { ...req.body, codigoUsuario: usuarioAccion };

    const version = await service.createVersionAP(dataDTO);
    return res.status(201).json({ ok: true, version });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al crear la versión AP."
    });
  }
};

const updateVersionAP = async (req, res = response) => {
  try {
    const { id } = req.params;

    // QPLUS: Hidratación del payload de auditoría
    const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';
    const dataDTO = { ...req.body, codigoUsuario: usuarioAccion };

    const version = await service.updateVersionAP(id, dataDTO);
    return res.status(200).json({ ok: true, version });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al actualizar la versión AP."
    });
  }
};

const deleteVersionAP = async (req, res = response) => {
  try {
    const { id } = req.params;
    await service.deleteVersionAP(id);

    return res.status(200).json({
      ok: true,
      msg: "Versión AP eliminada correctamente."
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al eliminar la versión AP."
    });
  }
};

module.exports = {
  getVersionesAP,
  getVersionAPById,
  createVersionAP,
  updateVersionAP,
  deleteVersionAP
};