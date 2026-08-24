/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Error Handling
*/
const { response } = require("express");
const ContenidosELService = require("../services/contenidos-el.service");

const service = new ContenidosELService();

const getContenidos = async (req, res = response) => {
  try {
    const contenidos = await service.getContenidos();
    return res.status(200).json({ ok: true, contenidos });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error interno al obtener contenidos."
    });
  }
};

const getContenidoByCode = async (req, res = response) => {
  try {
    const { id } = req.params;
    const contenido = await service.getContenidoByCode(id);
    return res.status(200).json({ ok: true, contenido });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al obtener el contenido solicitado."
    });
  }
};

const createContenido = async (req, res = response) => {
  try {
    // QPLUS: Inyección de contexto de auditoría
    const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';
    const dataDTO = { ...req.body, codigoUsuario: usuarioAccion };

    const contenidoDB = await service.createContenido(dataDTO);
    return res.status(201).json({ ok: true, contenidoDB });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al crear el contenido."
    });
  }
};

const updateContenido = async (req, res = response) => {
  try {
    const { codigoContenido, ...data } = req.body;

    // QPLUS: Hidratación del payload de auditoría
    const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';
    const dataDTO = { ...data, codigoUsuario: usuarioAccion };

    const contenidoActualizado = await service.updateContenido(codigoContenido, dataDTO);
    return res.status(200).json({ ok: true, contenidoActualizado });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al actualizar el contenido."
    });
  }
};

const deleteContenido = async (req, res = response) => {
  try {
    const { id } = req.params;
    await service.deleteContenido(id);

    return res.status(200).json({
      ok: true,
      msg: "Contenido eliminado correctamente."
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al eliminar el contenido."
    });
  }
};

module.exports = {
  getContenidos,
  getContenidoByCode,
  createContenido,
  updateContenido,
  deleteContenido,
};