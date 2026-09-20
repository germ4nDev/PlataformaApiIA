/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Audit Standards
*/
const { response } = require("express");
const ParametrosSistemaService = require("../services/parametros-sistema.service");

const service = new ParametrosSistemaService();

const getParametros = async (req, res = response) => {
  try {
    const parametros = await service.getParametros();
    return res.status(200).json({ ok: true, parametros });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error interno al obtener los parámetros."
    });
  }
};

const getParametroByCodigo = async (req, res = response) => {
  try {
    const { id } = req.params;
    console.log('codigo', id);

    const parametro = await service.getParametroById(id);
    return res.status(200).json({ ok: true, parametro });
  } catch (error) {
    return res.status(error.statusCode || 404).json({
      ok: false,
      msg: error.msg || "Error al obtener el parámetro solicitado."
    });
  }
};

const createParametro = async (req, res = response) => {
  try {
    // QPLUS: Auditoría inicial
    const dataDTO = { ...req.body };
    console.log('parametro controlaador', dataDTO);

    console.log('parametro dto', dataDTO);

    const parametro = await service.createParametro(dataDTO);
    console.log('parametro creado', parametro);

    return res.status(201).json({ ok: true, parametro });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al crear el parámetro.",
      parametro: error.parametro || null
    });
  }
};

const updateParametro = async (req, res = response) => {
  try {
    const { id } = req.params;

    // QPLUS: Hidratación del payload de auditoría
    const dataDTO = { ...req.body };

    const parametro = await service.updateParametro(id, dataDTO);
    return res.status(200).json({ ok: true, parametro });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al actualizar el parámetro."
    });
  }
};

const deleteParametro = async (req, res = response) => {
  try {
    const { id } = req.params;
    await service.deleteParametro(id);

    return res.status(200).json({
      ok: true,
      msg: "Parámetro eliminado correctamente."
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al eliminar el parámetro."
    });
  }
};

module.exports = {
  getParametros,
  getParametroByCodigo,
  createParametro,
  updateParametro,
  deleteParametro
};