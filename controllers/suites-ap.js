/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Audit Standards
*/
const { response } = require("express");
const SuitesAPService = require("../services/suites-ap.service");

const service = new SuitesAPService();

const getSuites = async (req, res = response) => {
  try {
    const suites = await service.getSuites();
    return res.status(200).json({ ok: true, suites });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error interno al obtener las suites."
    });
  }
};

const getSuiteById = async (req, res = response) => {
  try {
    const { id } = req.params;
    const suite = await service.getSuiteById(id);
    return res.status(200).json({ ok: true, suite });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al obtener la suite solicitada."
    });
  }
};

const createSuite = async (req, res = response) => {
  try {
    const dataDTO = { ...req.body };

    const suite = await service.createSuite(dataDTO);
    return res.status(201).json({ ok: true, suite });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al crear la suite."
    });
  }
};

const updateSuite = async (req, res = response) => {
  try {
    const { id } = req.params;
    const dataDTO = { ...req.body };

    const suite = await service.updateSuite(id, dataDTO);
    return res.status(200).json({ ok: true, suite });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al actualizar la suite."
    });
  }
};

const deleteSuite = async (req, res = response) => {
  try {
    const { id } = req.params;
    await service.deleteSuite(id);

    return res.status(200).json({
      ok: true,
      msg: "Suite eliminada correctamente."
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al eliminar la suite."
    });
  }
};

module.exports = {
  getSuites,
  getSuiteById,
  createSuite,
  updateSuite,
  deleteSuite
};