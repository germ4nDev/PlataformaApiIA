/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Audit Standards
*/
const { response } = require("express");
const InventarioContenedoresService = require("../../services/torre-control/inventario-contenedores.service");

const { responderError } = require('../../helpers/errores.helper');
const service = new InventarioContenedoresService();

const getInventarios = async (req, res = response) => {
  try {
    const inventarios = await service.getInventarios();
    return res.status(200).json({ ok: true, inventarios });
  } catch (error) {
    return responderError(res, error, 'inventario-contenedores.getInventarios');
  }
};

const getInventarioById = async (req, res = response) => {
  try {
    const { id } = req.params;
    const inventario = await service.getInventarioById(id);
    return res.status(200).json({ ok: true, inventario });
  } catch (error) {
    return responderError(res, error, 'inventario-contenedores.getInventarioById');
  }
};

const createInventario = async (req, res = response) => {
  try {
    // QPLUS: Hidratación inicial y captura de auditoría
    const dataDTO = { ...req.body };
    const inventario = await service.createInventario(dataDTO);

    return res.status(201).json({ ok: true, inventario });
  } catch (error) {
    return responderError(res, error, 'inventario-contenedores.createInventario');
  }
};

const uploadMasivoInventario = async (req, res = response) => {
  try {
    // 1. Verificamos si express-fileupload capturó el archivo
    if (!req.files || !req.files.archivoExcel) {
      return res.status(400).json({ ok: false, msg: 'No se detectó ningún archivo Excel.' });
    }

    // 2. Extraemos el Buffer (.data) que necesita la librería xlsx
    const archivoBuffer = req.files.archivoExcel.data;
    const usuarioCreador = req.body.usuarioLogueado || 'SISTEMA';

    // 3. Enviamos el Buffer al servicio
    const resultado = await service.cargueMasivoExcel(archivoBuffer, usuarioCreador);

    return res.status(200).json({
      ok: true,
      msg: `Se importaron ${resultado.length} contenedores exitosamente.`,
    });

  } catch (error) {
    return responderError(res, error, 'inventario-contenedores.uploadMasivoInventario');
  }
};

const updateInventario = async (req, res = response) => {
  try {
    const { id } = req.params;
    const dataDTO = { ...req.body };

    const inventario = await service.updateInventario(id, dataDTO);
    return res.status(200).json({ ok: true, inventario });
  } catch (error) {
    return responderError(res, error, 'inventario-contenedores.updateInventario');
  }
};

const deleteInventario = async (req, res = response) => {
  try {
    const { id } = req.params;
    await service.deleteInventario(id);

    return res.status(200).json({
      ok: true,
      msg: "Contenedor eliminado/retirado correctamente del inventario."
    });
  } catch (error) {
    return responderError(res, error, 'inventario-contenedores.deleteInventario');
  }
};

module.exports = {
  getInventarios,
  getInventarioById,
  createInventario,
  updateInventario,
  uploadMasivoInventario,
  deleteInventario
};