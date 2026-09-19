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
    console.log('actividad parametros', req.params);
    const { id } = req.params;
    console.log('actividad code controller', id);

    const actividad = await service.getActividadPorId(id);

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
    const dataDTO = { ...req.body };
    console.log('data actividad crear', dataDTO);

    const actividadDB = await service.createActividad(dataDTO);
    return res.status(201).json({ ok: true, actividadDB });
  } catch (error) {
    // 🟢 AGREGA ESTA LÍNEA PARA VER EL VERDADERO ERROR:
    console.error('💥 ERROR REAL EN EL BACKEND:', error);

    res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || 'Error al crear la actividad.',
      error: error.details || error.message
    });
  }
};

const updateActividad = async (req, res = response) => {
  try {
    const { codigoActividad, ...data } = req.body;

    // QPLUS: Hidratación del payload
    const dataDTO = { ...data };
    // console.log('codigo actividad controller', codigoActividad);
    // console.log('actividad modificar controller', dataDTO);

    const actividadActualizada = await service.updateActividad(codigoActividad, dataDTO);
    return res.status(200).json({ ok: true, actividadActualizada });
  } catch (error) {
    console.log('🚨 ERROR REAL DE SEQUELIZE:', error);

    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: "Error al consultar la actividad por rol.",
      detalles: error.message || error
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