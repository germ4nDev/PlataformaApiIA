/*
    Author: German Valencia
    Refactored for: PORTTOS Standard - Controlador de Infraestructura
*/
const { response } = require('express');
const TiposInfraestructura = require('../../services/torre-control/tipos-infraestructura.service');

const { responderError } = require('../../helpers/errores.helper');
const { contextoUsuario } = require('../../helpers/controlador.helper');
// Instanciamos el servicio
const TiposInfraestructuraService = new TiposInfraestructura();

const getTipoInfraestructuraes = async (req, res = response) => {
  try {
    // Si pasamos ?activos=true en la URL, filtramos solo los activos para el Lobby
    const tiposInfraestructura = await TiposInfraestructuraService.getTipoInfraestructuraes();
    res.json({
      ok: true,
      data: tiposInfraestructura.data,
      statusCode: 200
    });
  } catch (error) {
    return responderError(res, error, 'tipos-infraestructura.getTipoInfraestructuraes');
  }
};

const getTipoInfraestructuraById = async (req, res = response) => {
  try {
    const { id } = req.params;
    const tipoInfreaestructura = await TiposInfraestructuraService.getTipoInfraestructuraById(id);

    res.json({
      ok: true,
      data: tipoInfreaestructura
    });
  } catch (error) {
    return responderError(res, error, 'tipos-infraestructura.getTipoInfraestructuraById');
  }
};

const crearTipoInfraestructura = async (req, res = response) => {
  try {
    // Aquí puedes inyectar el usuario logueado si usas un middleware de JWT (ej. req.usuario.codigo)
    const userContext = contextoUsuario(req);

    const nuevoInfraestructura = await TiposInfraestructuraService.crearTipoInfraestructura(req.body, userContext);

    res.status(201).json({
      ok: true,
      msg: 'Tipo Infraestructura creado exitosamente',
      data: nuevoInfraestructura
    });
  } catch (error) {
    return responderError(res, error, 'tipos-infraestructura.crearTipoInfraestructura');
  }
};

const updateTipoInfraestructura = async (req, res = response) => {
  try {
    const { id } = req.params;
    const userContext = contextoUsuario(req);
    // console.log('id', id);   // [ruido de consola: comentado 2026-10-26]
    // console.log('req.body', req.body);   // [ruido de consola: comentado 2026-10-26]

    const tipoInfreaestructuraActualizado = await TiposInfraestructuraService.updateTipoInfraestructura(id, req.body, userContext);

    res.json({
      ok: true,
      msg: 'Infraestructura actualizado exitosamente',
      data: tipoInfreaestructuraActualizado
    });
  } catch (error) {
    return responderError(res, error, 'tipos-infraestructura.updateTipoInfraestructura');
  }
};

const deleteTipoInfraestructura = async (req, res = response) => {
  try {
    const { id } = req.params;
    const tipoInfreaestructuraEliminado = await TiposInfraestructuraService.deleteTipoInfraestructura(id);

    res.json({
      ok: true,
      msg: 'Infraestructura eliminado correctamente',
      data: tipoInfreaestructuraEliminado
    });
  } catch (error) {
    return responderError(res, error, 'tipos-infraestructura.deleteTipoInfraestructura');
  }
};

module.exports = {
  getTipoInfraestructuraes,
  getTipoInfraestructuraById,
  crearTipoInfraestructura,
  updateTipoInfraestructura,
  deleteTipoInfraestructura
};