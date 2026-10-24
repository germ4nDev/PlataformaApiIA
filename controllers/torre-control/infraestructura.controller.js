/*
    Author: German Valencia
    Pattern: PORTTOS Standard - Controlador de Infraestructura
*/
const { response } = require('express');
const InfraestructuraService = require('../../services/torre-control/infraestructura.service');

const { responderError } = require('../../helpers/errores.helper');
const { contextoUsuario } = require('../../helpers/controlador.helper');
const infraestructuraService = new InfraestructuraService();

const getInfraestructuras = async (req, res = response) => {
  try {
    const respuesta = await infraestructuraService.getInfraestructuras();

    res.status(respuesta.statusCode).json({
      ok: respuesta.ok,
      data: respuesta.data
    });
  } catch (error) {
    return responderError(res, error, 'infraestructura.getInfraestructuras');
  }
};

const getInfraestructuraById = async (req, res = response) => {
  try {
    const { id } = req.params;
    const respuesta = await infraestructuraService.getInfraestructuraById(id);

    if (!respuesta.ok) {
      return res.status(respuesta.statusCode).json({
        ok: false,
        msg: `No se encontró la infraestructura con el ID: ${id}`
      });
    }

    res.status(respuesta.statusCode).json({
      ok: true,
      data: respuesta.data
    });
  } catch (error) {
    return responderError(res, error, 'infraestructura.getInfraestructuraById');
  }
};

const crearInfraestructura = async (req, res = response) => {
  try {
    const userContext = contextoUsuario(req);
    const nuevaInfraestructura = await infraestructuraService.crearInfraestructura(req.body, userContext);

    res.status(201).json({
      ok: true,
      msg: 'Infraestructura creada exitosamente',
      data: nuevaInfraestructura
    });
  } catch (error) {
    return responderError(res, error, 'infraestructura.crearInfraestructura');
  }
};

const updateInfraestructura = async (req, res = response) => {
  try {
    const { id } = req.params;
    const userContext = contextoUsuario(req);
    // console.log('datos actualizar', req.body);   // [ruido de consola: comentado 2026-10-26]

    const infraestructuraActualizada = await infraestructuraService.updateInfraestructura(id, req.body, userContext);

    res.json({
      ok: true,
      msg: 'Infraestructura actualizada exitosamente',
      data: infraestructuraActualizada
    });
  } catch (error) {
    return responderError(res, error, 'infraestructura.updateInfraestructura');
  }
};

const deleteInfraestructura = async (req, res = response) => {
  try {
    const { id } = req.params;
    const infraestructuraEliminada = await infraestructuraService.deleteInfraestructura(id);

    res.json({
      ok: true,
      msg: 'Infraestructura eliminada correctamente',
      data: infraestructuraEliminada
    });
  } catch (error) {
    return responderError(res, error, 'infraestructura.deleteInfraestructura');
  }
};

module.exports = {
  getInfraestructuras,
  getInfraestructuraById,
  crearInfraestructura,
  updateInfraestructura,
  deleteInfraestructura
};