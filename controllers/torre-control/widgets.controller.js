/*
    Author: German Valencia
    Refactored for: PORTTOS Standard - Controlador de Widgets
*/
const { response } = require('express');
const WidgetService = require('../../services/torre-control/widget.service');

const { responderError } = require('../../helpers/errores.helper');
const { contextoUsuario } = require('../../helpers/controlador.helper');
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
    return responderError(res, error, 'widgets.getWidgets');
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
    return responderError(res, error, 'widgets.getWidgetByCode');
  }
};

const crearWidget = async (req, res = response) => {
  try {
    // Aquí puedes inyectar el usuario logueado si usas un middleware de JWT (ej. req.usuario.codigo)
    const userContext = contextoUsuario(req);

    const nuevoWidget = await widgetService.crearWidget(req.body, userContext);

    res.status(201).json({
      ok: true,
      msg: 'Widget creado exitosamente',
      data: nuevoWidget
    });
  } catch (error) {
    return responderError(res, error, 'widgets.crearWidget');
  }
};

const updateWidget = async (req, res = response) => {
  try {
    const { codigo_widget } = req.params;
    const userContext = contextoUsuario(req);

    const widgetActualizado = await widgetService.updateWidget(codigo_widget, req.body, userContext);

    res.json({
      ok: true,
      msg: 'Widget actualizado exitosamente',
      data: widgetActualizado
    });
  } catch (error) {
    return responderError(res, error, 'widgets.updateWidget');
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
    return responderError(res, error, 'widgets.deleteWidget');
  }
};

module.exports = {
  getWidgets,
  getWidgetByCode,
  crearWidget,
  updateWidget,
  deleteWidget
};