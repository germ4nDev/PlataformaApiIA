/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Error Handling
*/
const { response } = require("express");
const ActividadesService = require("../services/actividades.service");

const service = new ActividadesService();

const getActividades = async (req, res = response) => {
  try {
    const actividades = await service.getActividades();
    return res.status(200).json({ ok: true, actividades });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error interno al obtener actividades."
    });
  }
};

const getActividadById = async (req, res = response) => {
  try {
    const { id } = req.params;
    // Corrección del typo: service.g() -> service.getActividadById()
    const actividad = await service.getActividadById(id);

    // La validación de existencia (!actividad) se eliminó aquí porque 
    // el servicio ya se encarga de lanzar el throw { statusCode: 404 }
    return res.status(200).json({ ok: true, actividad });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al obtener la actividad."
    });
  }
};

const getActividadByCodeApp = async (req, res = response) => {
  try {
    const { id } = req.params;
    const actividades = await service.getActividadByCodeApp(id);
    return res.status(200).json({ ok: true, actividades });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al obtener actividades por aplicación."
    });
  }
};

const getActividadByCodeSuite = async (req, res = response) => {
  try {
    const { id } = req.params;
    const actividades = await service.getActividadByCodeSuite(id);
    return res.status(200).json({ ok: true, actividades });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al obtener actividades por suite."
    });
  }
};

const getActividadByCodeModulo = async (req, res = response) => {
  try {
    const { id } = req.params;
    const actividades = await service.getActividadByCodeModulo(id);
    return res.status(200).json({ ok: true, actividades });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al obtener actividades por módulo."
    });
  }
};

const createActividad = async (req, res = response) => {
  try {
    // QPLUS: Inyección de contexto de auditoría antes del servicio
    const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';
    const dataDTO = { ...req.body, codigoUsuario: usuarioAccion };

    const actividadDB = await service.createActividad(dataDTO);
    return res.status(201).json({ ok: true, actividadDB });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al crear la actividad."
    });
  }
};

const updateActividad = async (req, res = response) => {
  try {
    const { codigoActividad, ...data } = req.body;

    // QPLUS: Hidratación del payload
    const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';
    const dataDTO = { ...data, codigoUsuario: usuarioAccion };

    const actividadActualizada = await service.updateActividad(codigoActividad, dataDTO);
    return res.status(200).json({ ok: true, actividadActualizada });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al actualizar la actividad."
    });
  }
};

const deleteActividad = async (req, res = response) => {
  try {
    const { id } = req.params;
    await service.deleteActividad(id);
    return res.status(200).json({ ok: true, msg: "Actividad eliminada correctamente." });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al eliminar la actividad."
    });
  }
};

module.exports = {
  getActividades,
  getActividadById,
  getActividadByCodeApp,
  getActividadByCodeSuite,
  getActividadByCodeModulo,
  createActividad,
  updateActividad,
  deleteActividad,
};