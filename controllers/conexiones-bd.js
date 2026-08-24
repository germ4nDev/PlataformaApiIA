/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Error Handling
*/
const { response } = require("express");
const ConexionBDService = require("../services/conexiones-bd.service");

const service = new ConexionBDService();

const getConexiones = async (req, res = response) => {
  try {
    const conexiones = await service.getConexiones();
    return res.status(200).json({ ok: true, conexiones });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error interno al obtener conexiones de base de datos."
    });
  }
};

const getConexionById = async (req, res = response) => {
  try {
    const { id } = req.params;
    const conexion = await service.getConexionPorId(id);
    return res.status(200).json({ ok: true, conexion });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al obtener la conexión solicitada."
    });
  }
};

const createConexion = async (req, res = response) => {
  try {
    // QPLUS: Inyección de auditoría
    const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';
    const dataDTO = { ...req.body, codigoUsuario: usuarioAccion };

    const conexion = await service.createConexion(dataDTO);
    return res.status(201).json({ ok: true, conexion });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al crear la conexión."
    });
  }
};

const updateConexion = async (req, res = response) => {
  try {
    const { id } = req.params;

    // QPLUS: Hidratación del payload
    const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';
    const dataDTO = { ...req.body, codigoUsuario: usuarioAccion };

    const conexion = await service.actualizarConexion(id, dataDTO);
    return res.status(200).json({ ok: true, conexion });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al actualizar la conexión."
    });
  }
};

const deleteConexion = async (req, res = response) => {
  try {
    const { id } = req.params;
    await service.eliminarConexion(id);

    return res.status(200).json({
      ok: true,
      msg: "Conexión eliminada correctamente."
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al eliminar la conexión."
    });
  }
};

module.exports = {
  getConexiones,
  getConexionById,
  createConexion,
  updateConexion,
  deleteConexion
};