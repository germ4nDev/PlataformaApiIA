/*
    Author: German Valencia
    Pattern: PORTTOS Standard - Controlador de Muelles
*/
const { response } = require('express');
const MuellesService = require('../../services/torre-control/muelles.service');

const { responderError } = require('../../helpers/errores.helper');
const { contextoUsuario } = require('../../helpers/controlador.helper');
const muellesService = new MuellesService();

const getMuelles = async (req, res = response) => {
  try {
    const respuesta = await muellesService.getMuelles();

    res.status(respuesta.statusCode).json({
      ok: respuesta.ok,
      data: respuesta.data
    });
  } catch (error) {
    return responderError(res, error, 'muelle.getMuelles');
  }
};

const getMuelleById = async (req, res = response) => {
  try {
    const { id } = req.params;
    const respuesta = await muellesService.getMuelleById(id);

    if (!respuesta.ok) {
      return res.status(respuesta.statusCode).json({
        ok: false,
        msg: `No se encontró un muelle con el ID: ${id}`
      });
    }

    res.status(respuesta.statusCode).json({
      ok: true,
      data: respuesta.data
    });
  } catch (error) {
    return responderError(res, error, 'muelle.getMuelleById');
  }
};

const crearMuelle = async (req, res = response) => {
  try {
    const userContext = contextoUsuario(req);
    const nuevoMuelle = await muellesService.crearMuelle(req.body, userContext);

    res.status(201).json({
      ok: true,
      msg: 'Muelle creado exitosamente',
      data: nuevoMuelle
    });
  } catch (error) {
    return responderError(res, error, 'muelle.crearMuelle');
  }
};

const updateMuelle = async (req, res = response) => {
  try {
    const { id } = req.params;
    const userContext = contextoUsuario(req);

    // console.log('actualizar muelle id', id);   // [ruido de consola: comentado 2026-10-26]
    // console.log('actualizar muelle', req.body);   // [ruido de consola: comentado 2026-10-26]
    const muelleActualizado = await muellesService.updateMuelle(id, req.body, userContext);
    // console.log('actualizado muelle', muelleActualizado);   // [ruido de consola: comentado 2026-10-26]

    res.json({
      ok: true,
      msg: 'Muelle actualizado exitosamente',
      data: muelleActualizado
    });
  } catch (error) {
    return responderError(res, error, 'muelle.updateMuelle');
  }
};

const deleteMuelle = async (req, res = response) => {
  try {
    const { id_muelle } = req.params;
    const muelleEliminado = await muellesService.deleteMuelle(id_muelle);

    res.json({
      ok: true,
      msg: 'Muelle eliminado correctamente',
      data: muelleEliminado
    });
  } catch (error) {
    return responderError(res, error, 'muelle.deleteMuelle');
  }
};

module.exports = {
  getMuelles,
  getMuelleById,
  crearMuelle,
  updateMuelle,
  deleteMuelle
};