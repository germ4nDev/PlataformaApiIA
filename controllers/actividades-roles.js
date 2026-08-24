/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Error Handling
*/
const { response } = require("express");
const ActividadesRolesService = require("../services/actividades-roles.service");

const service = new ActividadesRolesService();

const getActividadesRoles = async (req, res = response) => {
  try {
    const actividadesRoles = await service.getActividadesRoles();
    return res.status(200).json({ ok: true, actividadesRoles });
  } catch (error) {
    // QPLUS: Propagación estándar de errores desde el servicio
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error interno al obtener actividades-roles."
    });
  }
};

const getActividadByCodeActividad = async (req, res = response) => {
  try {
    const { ac } = req.params;
    const data = await service.getActividadByCodeActividad(ac);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al consultar la actividad por código."
    });
  }
};

const getActividadByCodeRole = async (req, res = response) => {
  try {
    const { ro } = req.params;
    const data = await service.getActividadByCodeRole(ro);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al consultar la actividad por rol."
    });
  }
};

const createActividadRole = async (req, res = response) => {
  try {
    // QPLUS: Inyección de contexto de auditoría antes del servicio
    const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';
    const dataDTO = { ...req.body, codigoUsuario: usuarioAccion };

    const nuevaActividad = await service.createActividadRole(dataDTO);
    return res.status(201).json({ ok: true, nuevaActividad });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al crear la relación actividad-rol."
    });
  }
};

const updateActividadRole = async (req, res = response) => {
  try {
    const { ac, ro } = req.params;

    // QPLUS: El controlador asume la responsabilidad de hidratar el payload
    const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';
    const dataDTO = { ...req.body, codigoUsuario: usuarioAccion };

    // El servicio ahora solo recibe la data preparada
    const actividadActualizada = await service.updateActividadRole(ac, ro, dataDTO);
    return res.status(200).json({ ok: true, actividadActualizada });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al actualizar la relación actividad-rol."
    });
  }
};

const deleteActividadRole = async (req, res = response) => {
  try {
    const { ac, ro } = req.params;
    await service.deleteActividadRole(ac, ro);
    return res.status(200).json({ ok: true, msg: "Registro eliminado correctamente." });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al eliminar la relación actividad-rol."
    });
  }
};

module.exports = {
  getActividadesRoles,
  getActividadByCodeActividad,
  getActividadByCodeRole,
  createActividadRole,
  updateActividadRole,
  deleteActividadRole,
};