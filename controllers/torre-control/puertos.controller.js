/*
    Author: German Valencia
    Refactored for: PORTTOS Standard - Controlador de Puertos
    Update: Manejo estricto de códigos HTTP y respuestas del Servicio
*/
const { response } = require('express');
const PuertosService = require('../../services/torre-control/puertos.service');

const { responderError } = require('../../helpers/errores.helper');
const { contextoUsuario } = require('../../helpers/controlador.helper');
// Instanciamos el servicio
const puertosService = new PuertosService();

const getPuertos = async (req, res = response) => {
  try {
    const respuesta = await puertosService.getPuertos();

    // El servicio ya nos devuelve el statusCode y la data formateada
    res.status(respuesta.statusCode).json({
      ok: respuesta.ok,
      data: respuesta.data
    });
  } catch (error) {
    return responderError(res, error, 'puertos.getPuertos');
  }
};

const getPuertoById = async (req, res = response) => {
  try {
    const { id } = req.params;
    const respuesta = await puertosService.getPuertoById(id);

    // 🟢 CORRECCIÓN: Si el servicio reporta un 404, lo enviamos correctamente a Angular
    if (!respuesta.ok) {
      return res.status(respuesta.statusCode).json({
        ok: false,
        msg: `No se encontró un puerto con el ID: ${id}`
      });
    }

    res.status(respuesta.statusCode).json({
      ok: true,
      data: respuesta.data
    });
  } catch (error) {
    return responderError(res, error, 'puertos.getPuertoById');
  }
};

const crearPuerto = async (req, res = response) => {
  try {
    const userContext = contextoUsuario(req);

    const nuevoPuerto = await puertosService.crearPuerto(req.body, userContext);

    res.status(201).json({
      ok: true,
      msg: 'Puerto creado exitosamente',
      data: nuevoPuerto
    });
  } catch (error) {
    return responderError(res, error, 'puertos.crearPuerto');
  }
};

const updatePuerto = async (req, res = response) => {
  try {
    const { id } = req.params;
    const userContext = contextoUsuario(req);
    // console.log('controlador', req.body);   // [ruido de consola: comentado 2026-10-26]

    const puertoActualizado = await puertosService.updatePuerto(id, req.body, userContext);

    res.json({
      ok: true,
      msg: 'Puerto actualizado exitosamente',
      data: puertoActualizado
    });
  } catch (error) {
    return responderError(res, error, 'puertos.updatePuerto');
  }
};

const deletePuerto = async (req, res = response) => {
  try {
    const { id_puerto } = req.params;
    const puertoEliminado = await puertosService.deletePuerto(id_puerto);

    res.json({
      ok: true,
      msg: 'Puerto eliminado correctamente',
      data: puertoEliminado
    });
  } catch (error) {
    return responderError(res, error, 'puertos.deletePuerto');
  }
};

module.exports = {
  getPuertos,
  getPuertoById,
  crearPuerto,
  updatePuerto,
  deletePuerto
};