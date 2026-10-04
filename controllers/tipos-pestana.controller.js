const { response } = require("express");
const TiposPestanaService = require('../services/tipos-pestanas.service');

const service = new TiposPestanaService();

const getTiposPestana = async (req, res) => {
  try {
    const resultado = await service.obtenerTiposPestana();

    return res.status(200).json({
      ok: true,
      respuesta: resultado
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error al obtener los tipos de pestana."
    });
  }
};

const getTipoPestanaById = async (req, res) => {
  try {
    const tipoRole = await service.obtenerTipoPestanaPorId(req.params.id);
    return res.status(200).json({ ok: true, tipoRole });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ ok: false, msg: error.msg || 'Error interno' });
  }
};

const crearTipoPestana = async (req, res) => {
  try {
    const { error, value } = TipoPestanaSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ ok: false, msg: error.details[0].message });
    }

    const tipoRole = await service.crearTipoPestana(value);
    return res.status(201).json({ ok: true, tipoRole });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ ok: false, msg: error.msg || 'Error interno' });
  }
};

const actualizarTipoPestana = async (req, res) => {
  try {
    const { error, value } = TipoPestanaSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ ok: false, msg: error.details[0].message });
    }

    const tipoRole = await service.actualizarTipoPestana(req.params.id, value);
    return res.status(200).json({ ok: true, tipoRole });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ ok: false, msg: error.msg || 'Error interno' });
  }
};

const eliminarTipoPestana = async (req, res) => {
  try {
    const result = await service.eliminarTipoPestana(req.params.id);
    return res.status(200).json({ ok: true, msg: result.msg });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ ok: false, msg: error.msg || 'Error interno' });
  }
};

module.exports = {
  getTiposPestana,
  getTipoPestanaById,
  crearTipoPestana,
  actualizarTipoPestana,
  eliminarTipoPestana
};