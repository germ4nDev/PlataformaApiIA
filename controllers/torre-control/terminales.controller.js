/*
    Author: German Valencia
    Pattern: QPLUS Standard - Controlador de Terminales
*/
const { response } = require('express');
const TerminalsService = require('../../services/torre-control/terminales.service'); // Asegura que la ruta coincida

const terminalesService = new TerminalsService();

const getTerminales = async (req, res = response) => {
  try {
    const respuesta = await terminalesService.getTerminales();

    res.status(respuesta.statusCode).json({
      ok: respuesta.ok,
      data: respuesta.data
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || 'Error al obtener el listado de terminales. Hable con el administrador.',
      error: error.message || error
    });
  }
};

const getTerminalById = async (req, res = response) => {
  try {
    // 🟢 Ajustado a id para consistencia con los demás métodos
    const { id } = req.params;
    const respuesta = await terminalesService.getTerminalById(id);

    if (!respuesta.ok) {
      return res.status(respuesta.statusCode).json({
        ok: false,
        msg: `No se encontró una terminal con el ID: ${id}`
      });
    }

    res.status(respuesta.statusCode).json({
      ok: true,
      data: respuesta.data
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || 'Error al obtener la terminal'
    });
  }
};

const crearTerminal = async (req, res = response) => {
  try {
    const userContext = { codigoUsuario: req.uid || 'SISTEMA_ADMIN' };
    const nuevaTerminal = await terminalesService.crearTerminal(req.body, userContext);

    res.status(201).json({
      ok: true,
      msg: 'Terminal creada exitosamente',
      data: nuevaTerminal
    });
  } catch (error) {
    const statusCode = error.type === 'ValidationError' ? 400 : (error.statusCode || 500);
    res.status(statusCode).json({
      ok: false,
      msg: error.type === 'ValidationError' ? 'Error de validación en los datos enviados' : (error.msg || 'Error al crear la terminal'),
      detalles: error.details || error
    });
  }
};

const updateTerminal = async (req, res = response) => {
  try {
    const { id } = req.params;
    const userContext = { codigoUsuario: req.uid || 'SISTEMA_ADMIN' };

    // 🟢 La lógica de la geocerca ya se procesa al 100% en el Service
    const terminalActualizada = await terminalesService.updateTerminal(id, req.body, userContext);

    res.json({
      ok: true,
      msg: 'Terminal actualizada exitosamente',
      data: terminalActualizada
    });
  } catch (error) {
    const statusCode = error.type === 'ValidationError' ? 400 : (error.statusCode || 500);
    res.status(statusCode).json({
      ok: false,
      msg: error.type === 'ValidationError' ? 'Error de validación en los datos enviados' : (error.msg || 'Error al actualizar la terminal'),
      detalles: error.details || error
    });
  }
};

const deleteTerminal = async (req, res = response) => {
  try {
    const { id } = req.params;
    const terminalEliminada = await terminalesService.deleteTerminal(id);

    res.json({
      ok: true,
      msg: 'Terminal eliminada correctamente',
      data: terminalEliminada
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || 'Error al eliminar la terminal'
    });
  }
};

module.exports = {
  getTerminales,
  getTerminalById,
  crearTerminal,
  updateTerminal,
  deleteTerminal
};