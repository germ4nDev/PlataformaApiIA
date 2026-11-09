const TiposWidgetService = require('../services/tipos-widget.service');
const { TipoWidgetSchema } = require('../models/tipo-widget.model');
const { responderError } = require('../helpers/errores.helper');

const service = new TiposWidgetService();

const getTiposWidget = async (req, res) => {
  try {
    const resultado = await service.obtenerTiposWidget();
    // console.log('resultado', resultado);
    return res.status(200).json({
      ok: true,
      respuesta: resultado
    });
  } catch (error) {
    console.error("🔥 ERROR REAL AL GUARDAR LAYOUT:", error); // 🟢 Esto revelará al culpable

    if (error.type === 'ValidationError') {
      return res.status(400).json({ ok: false, msg: "Error de validación", errores: error.details });
    }
    res.status(error.statusCode || 500).json({ ok: false, msg: error.msg || 'Error interno.' });
  }
};

const getTipoWidgetById = async (req, res) => {
  try {
    const tipoRole = await service.obtenerTipoWidgetPorId(req.params.id);
    return res.status(200).json({ ok: true, tipoRole });
  } catch (error) {
    return responderError(res, error, 'tipos-widget'); // CC-141: registra los 5xx y traduce los de la base
  }
};

const crearTipoWidget = async (req, res) => {
  try {
    const usuario = req.codigoUsuario || req.body.codigoUsuarioCreacion; // CC-141: auditoría del token
    const { error, value } = TipoWidgetSchema.validate({ ...req.body, codigoUsuarioCreacion: usuario, codigoUsuarioModificacion: usuario }, { stripUnknown: true }); // sin campos de la lista (idTipo…)
    if (error) {
      return res.status(400).json({ ok: false, msg: error.details[0].message });
    }

    const tipoRole = await service.crearTipoWidget(value);
    return res.status(201).json({ ok: true, tipoRole });
  } catch (error) {
    return responderError(res, error, 'tipos-widget'); // CC-141: registra los 5xx y traduce los de la base
  }
};

const actualizarTipoWidget = async (req, res) => {
  try {
    const { error, value } = TipoWidgetSchema.validate({ ...req.body, codigoUsuarioModificacion: req.codigoUsuario || req.body.codigoUsuarioModificacion }, { stripUnknown: true }); // CC-141: auditoría del token
    if (error) {
      return res.status(400).json({ ok: false, msg: error.details[0].message });
    }

    const tipoRole = await service.actualizarTipoWidget(req.params.id, value);
    return res.status(200).json({ ok: true, tipoRole });
  } catch (error) {
    return responderError(res, error, 'tipos-widget'); // CC-141: registra los 5xx y traduce los de la base
  }
};

const eliminarTipoWidget = async (req, res) => {
  try {
    const result = await service.eliminarTipoWidget(req.params.id);
    return res.status(200).json({ ok: true, msg: result.msg });
  } catch (error) {
    return responderError(res, error, 'tipos-widget'); // CC-141: registra los 5xx y traduce los de la base
  }
};

module.exports = {
  getTiposWidget,
  getTipoWidgetById,
  crearTipoWidget,
  actualizarTipoWidget,
  eliminarTipoWidget
};