/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Error Handling
*/
const { response } = require("express");
const ItemService = require("../services/items.service");

const service = new ItemService();

const getItems = async (req, res = response) => {
  try {
    const items = await service.getItems();
    return res.status(200).json({ ok: true, items });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error interno al obtener los ítems."
    });
  }
};

const getItemById = async (req, res = response) => {
  try {
    const { id } = req.params;
    const item = await service.getItemById(id);
    return res.status(200).json({ ok: true, item });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al obtener el ítem solicitado."
    });
  }
};

const createItem = async (req, res = response) => {
  try {
    const dataDTO = { ...req.body };
    const item = await service.createItem(dataDTO);
    return res.status(201).json({ ok: true, item });
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

const updateItem = async (req, res = response) => {
  try {
    const { id } = req.params;

    const dataDTO = { ...req.body };
    console.log('item comtroller', dataDTO);
    const item = await service.updateItem(id, dataDTO);
    return res.status(200).json({ ok: true, item });
  } catch (error) {
    console.error('💥 ERROR REAL EN EL BACKEND:', error);
    res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || 'Error al crear el item.',
      error: error.details || error.message
    });
  }
};

const deleteItem = async (req, res = response) => {
  try {
    const { id } = req.params;
    await service.deleteItem(id);

    return res.status(200).json({
      ok: true,
      msg: "Ítem eliminado correctamente."
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al eliminar el ítem."
    });
  }
};

module.exports = {
  getItems,
  getItemById,
  createItem,
  updateItem,
  deleteItem
};