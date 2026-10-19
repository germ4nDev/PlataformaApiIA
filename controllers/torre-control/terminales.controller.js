/*
    Author: German Valencia
    Pattern: PORTTOS Standard - Controlador de Terminales
*/
const { response } = require('express');
const { responderError } = require('../../helpers/errores.helper');
const { contextoUsuario } = require('../../helpers/controlador.helper');
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
    return responderError(res, error, 'terminales.getTerminales');
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
    return responderError(res, error, 'terminales.getTerminalById');
  }
};

const crearTerminal = async (req, res = response) => {
  try {
    const userContext = contextoUsuario(req);
    const nuevaTerminal = await terminalesService.crearTerminal(req.body, userContext);

    res.status(201).json({
      ok: true,
      msg: 'Terminal creada exitosamente',
      data: nuevaTerminal
    });
  } catch (error) {
    return responderError(res, error, 'terminales.crearTerminal');
  }
};

const updateTerminal = async (req, res = response) => {
  try {
    const { id } = req.params;
    const userContext = contextoUsuario(req);

    // 🟢 La lógica de la geocerca ya se procesa al 100% en el Service
    const terminalActualizada = await terminalesService.updateTerminal(id, req.body, userContext);

    res.json({
      ok: true,
      msg: 'Terminal actualizada exitosamente',
      data: terminalActualizada
    });
  } catch (error) {
    return responderError(res, error, 'terminales.updateTerminal');
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
    return responderError(res, error, 'terminales.deleteTerminal');
  }
};

module.exports = {
  getTerminales,
  getTerminalById,
  crearTerminal,
  updateTerminal,
  deleteTerminal
};