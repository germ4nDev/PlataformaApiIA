/*
    Author: German Valencia
    Refactored for: QPLUS Standard - Controlador de Widgets
*/
const { response } = require('express');
const WidgetService = require('../../services/torre-control/widget.service');

// Instanciamos el servicio
const widgetService = new WidgetService();

const getWidgets = async (req, res = response) => {
  try {
    // Si pasamos ?activos=true en la URL, filtramos solo los activos para el Lobby
    const widgets = await widgetService.getWidgets();
    res.json({
      ok: true,
      data: widgets.data,
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

const getWidgetByCode = async (req, res = response) => {
  try {
    const { codigo_widget } = req.params;
    const widget = await widgetService.getWidgetByCode(codigo_widget);

    res.json({
      ok: true,
      data: widget
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || 'Error al obtener el widget'
    });
  }
};

const crearWidget = async (req, res = response) => {
  try {
    // Aquí puedes inyectar el usuario logueado si usas un middleware de JWT (ej. req.usuario.codigo)
    const userContext = { codigoUsuario: req.uid || 'SISTEMA_ADMIN' };

    const nuevoWidget = await widgetService.crearWidget(req.body, userContext);

    res.status(201).json({
      ok: true,
      msg: 'Widget creado exitosamente',
      data: nuevoWidget
    });
  } catch (error) {
    // Si es un error de validación de Joi (DTO), mandamos un 400 Bad Request
    const statusCode = error.type === 'ValidationError' ? 400 : (error.statusCode || 500);
    res.status(statusCode).json({
      ok: false,
      msg: error.msg || 'Error al crear el widget',
      detalles: error.details || error
    });
  }
};

const updateWidget = async (req, res = response) => {
  try {
    const { codigo_widget } = req.params;
    const userContext = { codigoUsuario: req.uid || 'SISTEMA_ADMIN' };

    const widgetActualizado = await widgetService.updateWidget(codigo_widget, req.body, userContext);

    res.json({
      ok: true,
      msg: 'Widget actualizado exitosamente',
      data: widgetActualizado
    });
  } catch (error) {
    const statusCode = error.type === 'ValidationError' ? 400 : (error.statusCode || 500);
    res.status(statusCode).json({
      ok: false,
      msg: error.msg || 'Error al actualizar el widget',
      detalles: error.details || error
    });
  }
};

const deleteWidget = async (req, res = response) => {
  try {
    const { codigo_widget } = req.params;
    const widgetEliminado = await widgetService.deleteWidget(codigo_widget);

    res.json({
      ok: true,
      msg: 'Widget eliminado correctamente',
      data: widgetEliminado
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || 'Error al eliminar el widget'
    });
  }
};

module.exports = {
  getWidgets,
  getWidgetByCode,
  crearWidget,
  updateWidget,
  deleteWidget
};