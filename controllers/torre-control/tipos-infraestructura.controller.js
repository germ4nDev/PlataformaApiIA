/*
    Author: German Valencia
    Refactored for: PORTTOS Standard - Controlador de Infraestructura
*/
const { response } = require('express');
const TiposInfraestructura = require('../../services/torre-control/tipos-infraestructura.service');

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
    res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || 'Hable con el administrador',
      error: error.message || error
    });
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
    res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || 'Error al obtener el tipoInfreaestructura'
    });
  }
};

const crearTipoInfraestructura = async (req, res = response) => {
  try {
    // Aquí puedes inyectar el usuario logueado si usas un middleware de JWT (ej. req.usuario.codigo)
    const userContext = { codigoUsuario: req.uid || 'SISTEMA_ADMIN' };

    const nuevoInfraestructura = await TiposInfraestructuraService.crearTipoInfraestructura(req.body, userContext);

    res.status(201).json({
      ok: true,
      msg: 'Tipo Infraestructura creado exitosamente',
      data: nuevoInfraestructura
    });
  } catch (error) {
    // Si es un error de validación de Joi (DTO), mandamos un 400 Bad Request
    const statusCode = error.type === 'ValidationError' ? 400 : (error.statusCode || 500);
    res.status(statusCode).json({
      ok: false,
      msg: error.msg || 'Error al crear el tipoInfreaestructura',
      detalles: error.details || error
    });
  }
};

const updateTipoInfraestructura = async (req, res = response) => {
  try {
    const { id } = req.params;
    const userContext = { codigoUsuario: req.uid || 'SISTEMA_ADMIN' };
    console.log('id', id);
    console.log('req.body', req.body);

    const tipoInfreaestructuraActualizado = await TiposInfraestructuraService.updateTipoInfraestructura(id, req.body, userContext);

    res.json({
      ok: true,
      msg: 'Infraestructura actualizado exitosamente',
      data: tipoInfreaestructuraActualizado
    });
  } catch (error) {
    const statusCode = error.type === 'ValidationError' ? 400 : (error.statusCode || 500);
    res.status(statusCode).json({
      ok: false,
      msg: error.msg || 'Error al actualizar el tipoInfreaestructura',
      detalles: error.details || error
    });
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
    res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || 'Error al eliminar el tipoInfreaestructura'
    });
  }
};

module.exports = {
  getTipoInfraestructuraes,
  getTipoInfraestructuraById,
  crearTipoInfraestructura,
  updateTipoInfraestructura,
  deleteTipoInfraestructura
};