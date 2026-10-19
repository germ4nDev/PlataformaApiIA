/*
    Author: German Valencia
    Refactored for: PORTTOS Standard - Controlador de Faros
    Update: Corrección de constructor, limpieza de código legado y variables
*/
const { response } = require('express');
const farosService = require('../../services/torre-control/faro.service');

const { responderError } = require('../../helpers/errores.helper');
const { contextoUsuario } = require('../../helpers/controlador.helper');
const getFaros = async (req, res = response) => {
  try {
    const respuesta = await farosService.getFaros();

    res.status(respuesta.statusCode).json({
      ok: respuesta.ok,
      data: respuesta.data
    });
  } catch (error) {
    return responderError(res, error, 'faro.getFaros');
  }
};

const getFaroById = async (req, res = response) => {
  try {
    const { id } = req.params;
    const respuesta = await farosService.getFaroById(id);

    if (!respuesta.ok) {
      return res.status(respuesta.statusCode).json({
        ok: false,
        msg: `No se encontró un faro con el ID: ${id}`
      });
    }

    res.status(respuesta.statusCode).json({
      ok: true,
      data: respuesta.data
    });
  } catch (error) {
    return responderError(res, error, 'faro.getFaroById');
  }
};

const crearFaro = async (req, res = response) => {
  try {
    const userContext = contextoUsuario(req);

    const nuevoFaro = await farosService.crearFaro(req.body, userContext);

    res.status(201).json({
      ok: true,
      msg: 'Faro creado exitosamente',
      data: nuevoFaro
    });
  } catch (error) {
    return responderError(res, error, 'faro.crearFaro');
  }
};

const updateFaro = async (req, res = response) => {
  try {
    const { id } = req.params;
    const userContext = contextoUsuario(req);

    const faroActualizado = await farosService.updateFaro(id, req.body, userContext);

    res.json({
      ok: true,
      msg: 'Faro actualizado exitosamente',
      data: faroActualizado
    });
  } catch (error) {
    return responderError(res, error, 'faro.updateFaro');
  }
};

const deleteFaro = async (req, res = response) => {
  try {
    const { id } = req.params;
    const faroEliminado = await farosService.deleteFaro(id);

    res.json({
      ok: true,
      msg: 'Faro eliminado correctamente',
      data: faroEliminado
    });
  } catch (error) {
    return responderError(res, error, 'faro.deleteFaro');
  }
};

module.exports = {
  getFaros,
  getFaroById,
  crearFaro,
  updateFaro,
  deleteFaro
};