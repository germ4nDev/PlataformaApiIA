const TiposWidgetService = require('../services/tipos-widget.service');
const { TipoWidgetSchema } = require('../models/tipo-widget.model');

const service = new TiposWidgetService();

const getTiposWidget = async (req, res) => {
  try {
    const resultado = await service.obtenerTiposWidget();

    return res.status(200).json({
      ok: true,
      respuesta: { msg: resultado }
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error al obtener los tipos de widgets."
    });
  }
};

const getTipoWidgetById = async (req, res) => {
  try {
    const tipoRole = await service.obtenerTipoWidgetPorId(req.params.id);
    return res.status(200).json({ ok: true, tipoRole });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ ok: false, msg: error.msg || 'Error interno' });
  }
};

const crearTipoWidget = async (req, res) => {
  try {
    const { error, value } = TipoWidgetSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ ok: false, msg: error.details[0].message });
    }

    const tipoRole = await service.crearTipoWidget(value);
    return res.status(201).json({ ok: true, tipoRole });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ ok: false, msg: error.msg || 'Error interno' });
  }
};

const actualizarTipoWidget = async (req, res) => {
  try {
    const { error, value } = TipoWidgetSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ ok: false, msg: error.details[0].message });
    }

    const tipoRole = await service.actualizarTipoWidget(req.params.id, value);
    return res.status(200).json({ ok: true, tipoRole });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ ok: false, msg: error.msg || 'Error interno' });
  }
};

const eliminarTipoWidget = async (req, res) => {
  try {
    const result = await service.eliminarTipoWidget(req.params.id);
    return res.status(200).json({ ok: true, msg: result.msg });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ ok: false, msg: error.msg || 'Error interno' });
  }
};

module.exports = {
  getTiposWidget,
  getTipoWidgetById,
  crearTipoWidget,
  actualizarTipoWidget,
  eliminarTipoWidget
};