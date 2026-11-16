/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Audit Standards
*/
const { response } = require("express");
const PestanasService = require("../services/pestanas.service");

const service = new PestanasService();

const getPestanasTodas = async (req, res) => {
  try {
    const resultado = await service.obtenerPestanas();
    // console.log('resultado', resultado);
    return res.status(200).json({
      ok: true,
      respuesta: resultado
    });
  } catch (error) {
    console.error("🔥 ERROR REAL PESTANAS:", error); // 🟢 Esto revelará al culpable

    if (error.type === 'ValidationError') {
      return res.status(400).json({ ok: false, msg: "Error de validación", errores: error.details });
    }
    res.status(error.statusCode || 500).json({ ok: false, msg: error.msg || 'Error interno.' });
  }
};

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
    console.error("🔥 ERROR REAL PESTANAS:", error); // 🟢 Esto revelará al culpable

    if (error.type === 'ValidationError') {
      return res.status(400).json({ ok: false, msg: "Error de validación", errores: error.details });
    }
    res.status(error.statusCode || 500).json({ ok: false, msg: error.msg || 'Error interno.' });
  }
};

const getPestanaById = async (req, res = response) => {
  try {
    const { id } = req.params;
    // console.log('codigo controller', id);
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
    // console.log('codigo controller', id);
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
    // console.log('data contrller', dataDTO);

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
    // console.log('rawDta conbtroller', dataDTO);

    const tipo = await service.actualizarPestana(id, dataDTO);
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

// CC-203 (Utilidades › Pestañas, regla 19): la lectura por código y la escritura van por capas (services/plataforma/pestanas.service.js:
// validación, ícono y color, socket pestanas-actualizados; eliminar = inactivar). Las funciones de arriba con el mismo nombre quedan
// de referencia hasta retirarlas. La respuesta conserva `tipo` (forma anterior) y agrega `pestana`.
const Admin = require('./../services/plataforma/pestanas.service');
const { manejar, contextoUsuario } = require('../helpers/controlador.helper');
const usuario = (req) => contextoUsuario(req).codigoUsuario;

const getPestanaPorCodigo = manejar('Pestanas.obtener', async (req, res) => {
  const pestana = await Admin.obtener(req.params);
  res.json({ ok: true, pestana, tipo: pestana });
});
const crearPestana = manejar('Pestanas.crear', async (req, res) => {
  const pestana = await Admin.crear(req.body, usuario(req));
  res.status(201).json({ ok: true, pestana, tipo: pestana });
});
const modificarPestana = manejar('Pestanas.modificar', async (req, res) => {
  const pestana = await Admin.modificar(req.params.id, req.body, usuario(req));
  res.json({ ok: true, pestana, tipo: pestana });
});
const inactivarPestana = manejar('Pestanas.inactivar', async (req, res) => {
  res.json({ ok: true, ...(await Admin.inactivar(req.params, usuario(req))), msg: 'Pestaña inactivada.' });
});

module.exports = {
  getPestanas,
  getPestanasTodas,
  getPestanaById: getPestanaPorCodigo,
  getPestanaByCodeAplicacion,
  createPestana: crearPestana,
  updatePestana: modificarPestana,
  deletePestana: inactivarPestana
};