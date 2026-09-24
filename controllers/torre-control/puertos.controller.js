/*
    Author: German Valencia
    Refactored for: PORTTOS Standard - Controlador de Puertos
    Update: Manejo estricto de códigos HTTP y respuestas del Servicio
*/
const { response } = require('express');
const PuertosService = require('../../services/torre-control/puertos.service');

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
    res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || 'Error al obtener el listado de puertos. Hable con el administrador',
      error: error.message || error
    });
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
    res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || 'Error al obtener el puerto'
    });
  }
};

const crearPuerto = async (req, res = response) => {
  try {
    const userContext = { codigoUsuario: req.uid || 'SISTEMA_ADMIN' };

    const nuevoPuerto = await puertosService.crearPuerto(req.body, userContext);

    res.status(201).json({
      ok: true,
      msg: 'Puerto creado exitosamente',
      data: nuevoPuerto
    });
  } catch (error) {
    // 🟢 MAGIA PORTTOS: Atrapa el error de Joi (DTO) e informa a Angular exactamente qué falló
    const statusCode = error.type === 'ValidationError' ? 400 : (error.statusCode || 500);
    res.status(statusCode).json({
      ok: false,
      msg: error.type === 'ValidationError' ? 'Error de validación en los datos enviados' : (error.msg || 'Error al crear el puerto'),
      detalles: error.details || error
    });
  }
};

const updatePuerto = async (req, res = response) => {
  try {
    const { id } = req.params;
    const userContext = { codigoUsuario: req.uid || 'SISTEMA_ADMIN' };
    console.log('controlador', req.body);

    const puertoActualizado = await puertosService.updatePuerto(id, req.body, userContext);

    res.json({
      ok: true,
      msg: 'Puerto actualizado exitosamente',
      data: puertoActualizado
    });
  } catch (error) {
    const statusCode = error.type === 'ValidationError' ? 400 : (error.statusCode || 500);
    res.status(statusCode).json({
      ok: false,
      msg: error.type === 'ValidationError' ? 'Error de validación en los datos enviados' : (error.msg || 'Error al actualizar el puerto'),
      detalles: error.details || error
    });
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
    res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || 'Error al eliminar el puerto'
    });
  }
};

module.exports = {
  getPuertos,
  getPuertoById,
  crearPuerto,
  updatePuerto,
  deletePuerto
};