/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Error Handling
*/
const { response } = require("express");
const ServidorService = require("../services/servidores.service");

const service = new ServidorService();

const getServidores = async (req, res = response) => {
  try {
    const servidores = await service.getServidores();
    return res.status(200).json({ ok: true, servidores });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error interno al obtener los servidores."
    });
  }
};

const getServidorById = async (req, res = response) => {
  try {
    const { id } = req.params;
    const servidor = await service.getServidorById(id);
    return res.status(200).json({ ok: true, servidor });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al obtener el servidor solicitado."
    });
  }
};

const createServidor = async (req, res = response) => {
  try {
    // QPLUS: Inyección de auditoría
    const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';
    const dataDTO = { ...req.body, codigoUsuario: usuarioAccion };

    const servidor = await service.createServidor(dataDTO);
    return res.status(201).json({ ok: true, servidor });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al crear el servidor."
    });
  }
};

const updateServidor = async (req, res = response) => {
  try {
    const { id } = req.params;

    // QPLUS: Hidratación del payload de auditoría
    const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';
    const dataDTO = { ...req.body, codigoUsuario: usuarioAccion };

    const servidor = await service.updateServidor(id, dataDTO);
    return res.status(200).json({ ok: true, servidor });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al actualizar el servidor."
    });
  }
};

const deleteServidor = async (req, res = response) => {
  try {
    const { id } = req.params;
    await service.deleteServidor(id);

    return res.status(200).json({
      ok: true,
      msg: "Servidor eliminado correctamente."
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al eliminar el servidor."
    });
  }
};

module.exports = {
  getServidores,
  getServidorById,
  createServidor,
  updateServidor,
  deleteServidor
};