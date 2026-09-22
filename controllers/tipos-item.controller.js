/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Audit Standards
*/
const { response } = require("express");
const TiposItemService = require("../services/tipos-item.service");

const service = new TiposItemService();

const getTiposItem = async (req, res = response) => {
  try {
    const tipos = await service.getTiposItem();
    console.log('los tipos', tipos);

    return res.status(200).json({ ok: true, tipos });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error interno al obtener los tipos de ítem."
    });
  }
};

const getTipoItemById = async (req, res = response) => {
  try {
    const { id } = req.params;
    console.log('codigo controller', id);
    const tipo = await service.getTipoItemById(id);
    return res.status(200).json({ ok: true, tipo });
  } catch (error) {
    // 🟢 AGREGA ESTA LÍNEA PARA VER EL VERDADERO ERROR:
    console.error('💥 ERROR REAL EN EL BACKEND:', error);

    res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || 'Error al crear el item.',
      error: error.details || error.message
    });
  }
};

const createTipoItem = async (req, res = response) => {
  try {
    // QPLUS: Inyección de auditoría
    const dataDTO = { ...req.body };
    console.log('data contrller', dataDTO);

    const tipo = await service.createTipoItem(dataDTO);
    return res.status(201).json({ ok: true, tipo });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al crear el tipo de ítem."
    });
  }
};

const updateTipoItem = async (req, res = response) => {
  try {
    const { id } = req.params;

    const dataDTO = { ...req.body };
    console.log('rawDta conbtroller', dataDTO);

    const tipo = await service.updateTipoItem(id, dataDTO);
    return res.status(200).json({ ok: true, tipo });
  } catch (error) {
    // 🟢 AGREGA ESTA LÍNEA PARA VER EL VERDADERO ERROR:
    console.error('💥 ERROR REAL EN EL BACKEND:', error);

    res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || 'Error al crear el item.',
      error: error.details || error.message
    });
  }
};

const deleteTipoItem = async (req, res = response) => {
  try {
    const { id } = req.params;
    await service.deleteTipoItem(id);

    return res.status(200).json({
      ok: true,
      msg: "Tipo de ítem eliminado correctamente."
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al eliminar el tipo de ítem."
    });
  }
};

module.exports = {
  getTiposItem,
  getTipoItemById,
  createTipoItem,
  updateTipoItem,
  deleteTipoItem
};