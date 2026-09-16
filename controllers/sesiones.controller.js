/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Audit Standards (Sesiones)
*/
const { response } = require("express");
const SesionesService = require("../services/sesiones.service");

const service = new SesionesService();

const getSesionesActivas = async (req, res = response) => {
  try {
    const sesiones = await service.getSesionesActivas();
    return res.status(200).json({ ok: true, sesiones });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error interno al obtener las sesiones activas."
    });
  }
};

const getSesionById = async (req, res = response) => {
  try {
    const { id } = req.params;
    const sesion = await service.getSesionById(id);
    return res.status(200).json({ ok: true, sesion });
  } catch (error) {
    return res.status(error.statusCode || 404).json({
      ok: false,
      msg: error.msg || "Error al obtener la sesión solicitada."
    });
  }
};

const registrarSesion = async (req, res = response) => {
  try {
    const dataDTO = { ...req.body };
    console.log('sesion despues dto', dataDTO);
    const sesion = await service.registrarSesion(dataDTO);
    return res.status(201).json({ ok: true, sesion });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al registrar la sesión.",
      detalles: error.details || null
    });
  }
};

const actualizarContextoNavegacion = async (req, res = response) => {
  try {
    const { id } = req.params;
    const resultado = await service.actualizarContextoNavegacion(id, req.body);
    return res.status(200).json({ ok: true, ...resultado });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al actualizar el contexto de navegación."
    });
  }
};

const cerrarSesion = async (req, res = response) => {
  try {
    const { id } = req.params;
    await service.cerrarSesion(id);
    return res.status(200).json({
      ok: true,
      msg: "Sesión cerrada correctamente."
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al cerrar la sesión."
    });
  }
};

module.exports = {
  getSesionesActivas,
  getSesionById,
  registrarSesion,
  actualizarContextoNavegacion,
  cerrarSesion
};