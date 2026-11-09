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
      msg: error.msg || "Error interno al obtener los servidores.",
      errores: error.details // CC-137: detalle del Joi
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
      msg: error.msg || "Error al obtener el servidor solicitado.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

const createServidor = async (req, res = response) => {
  try {
    // QPLUS: Inyección de auditoría
    const usuarioAccion = req.codigoUsuario || 'SISTEMA'; // CC-137: del token (validarJWT)
    const dataDTO = { ...req.body, codigoUsuarioCreacion: usuarioAccion, codigoUsuarioModificacion: usuarioAccion };

    const servidor = await service.createServidor(dataDTO);
    return res.status(201).json({ ok: true, servidor });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al crear el servidor.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

const updateServidor = async (req, res = response) => {
  try {
    const { id } = req.params;

    // QPLUS: Hidratación del payload de auditoría
    const usuarioAccion = req.codigoUsuario || 'SISTEMA'; // CC-137: del token (validarJWT)
    const dataDTO = { ...req.body, codigoUsuarioModificacion: usuarioAccion };

    const servidor = await service.updateServidor(id, dataDTO);
    return res.status(200).json({ ok: true, servidor });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al actualizar el servidor.",
      errores: error.details // CC-137: detalle del Joi
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
      msg: error.msg || "Error al eliminar el servidor.",
      errores: error.details // CC-137: detalle del Joi
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