/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Audit Standards
*/
const { response } = require("express");
const PestanasService = require("../services/pestanas.service");

const service = new PestanasService();

const getPestanas = async (req, res) => {
  try {
    const { ca, cs } = req.params;

    if (!cs || !ca) {
      return res.status(400).json({
        success: false,
        message: 'Los parámetros codigoSuite y codigoAplicacion son obligatorios para cargar el tablero.'
      });
    }

    const pestanasBD = await service.obtenerPestanasPorContexto(cs, ca);

    res.status(200).json({
      success: true,
      data: pestanasBD,
      message: 'Pestañas cargadas exitosamente según el contexto'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error de servidor al cargar las pestañas.',
      error: error.toString()
    });
  }
};

const getPestanaById = async (req, res = response) => {
  try {
    const { id } = req.params;
    console.log('codigo controller', id);
    const tipo = await service.obtenerPestanaPorId(id);
    return res.status(200).json({ ok: true, tipo });
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

const getPestanaByCodeAplicacion = async (req, res = response) => {
  try {
    const { id } = req.params;
    console.log('codigo controller', id);
    const tipo = await service.obtenerPestanasPorAplicacion(id);
    return res.status(200).json({ ok: true, tipo });
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

const createPestana = async (req, res = response) => {
  try {
    // QPLUS: Inyección de auditoría
    const dataDTO = { ...req.body };
    console.log('data contrller', dataDTO);

    const tipo = await service.crearPestana(dataDTO);
    return res.status(201).json({ ok: true, tipo });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al crear el tipo de ítem."
    });
  }
};

const updatePestana = async (req, res = response) => {
  try {
    const { id } = req.params;

    const dataDTO = { ...req.body };
    console.log('rawDta conbtroller', dataDTO);

    const tipo = await service.acturlzarPestana(id, dataDTO);
    return res.status(200).json({ ok: true, tipo });
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

const deletePestana = async (req, res = response) => {
  try {
    const { id } = req.params;
    await service.eliminarPestana(id);

    return res.status(200).json({
      ok: true,
      msg: "Tipo de ítem eliminado correctamente."
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al eliminar el tipo de ítem."
    });
  }
};

module.exports = {
  getPestanas,
  getPestanaById,
  getPestanaByCodeAplicacion,
  createPestana,
  updatePestana,
  deletePestana
};