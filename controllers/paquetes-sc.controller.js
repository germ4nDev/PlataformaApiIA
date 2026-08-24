/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Error Handling
*/
const { response } = require("express");
const PaqueteSCService = require("../services/paquetes-sc.service");

const service = new PaqueteSCService();

const getPaquetes = async (req, res = response) => {
  try {
    const paquetes = await service.getPaquetesSC();
    return res.status(200).json({ ok: true, paquetes });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error interno al obtener los paquetes."
    });
  }
};

const getPaqueteById = async (req, res = response) => {
  try {
    const { id } = req.params;
    const paquete = await service.getPaqueteSCById(id);
    return res.status(200).json({ ok: true, paquete });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al obtener el paquete solicitado."
    });
  }
};

const createPaquete = async (req, res = response) => {
  try {
    // QPLUS: Inyección de auditoría
    const dataDTO = { ...req.body };
    console.log('crear paquete sc', req.body);
    const paquete = await service.createPaqueteSC(dataDTO);
    return res.status(201).json({ ok: true, paquete });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al crear el paquete."
    });
  }
};

const updatePaquete = async (req, res = response) => {
  try {
    const { id } = req.params;
    console.log('paquetesc raw', req.body);

    const dataDTO = { ...req.body };
    console.log('paquetesc dto', dataDTO);

    const paquete = await service.updatePaqueteSC(id, dataDTO);
    return res.status(200).json({ ok: true, paquete });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al actualizar el paquete."
    });
  }
};

const deletePaquete = async (req, res = response) => {
  try {
    const { id } = req.params;
    await service.deletePaqueteSC(id);

    return res.status(200).json({
      ok: true,
      msg: "Paquete eliminado correctamente."
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al eliminar el paquete."
    });
  }
};

module.exports = {
  getPaquetes,
  getPaqueteById,
  createPaquete,
  updatePaquete,
  deletePaquete
};