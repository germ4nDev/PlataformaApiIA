const { response } = require("express");
const TiposPestanaService = require('../services/tipos-pestanas.service');
const { responderError } = require('../helpers/errores.helper');
const { TipoPestanaSchema } = require('../models/tipo-pestana.model '); // CC-143: se usaba sin importarlo (crear y editar daban 500)

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
    return responderError(res, error, 'tipos-pestana'); // CC-141: registra los 5xx y traduce los de la base
  }
};

const crearTipoPestana = async (req, res) => {
  try {
    const usuario = req.codigoUsuario || req.body.codigoUsuarioCreacion; // CC-141: auditoría del token
    const { error, value } = TipoPestanaSchema.validate({ ...req.body, codigoUsuarioCreacion: usuario, codigoUsuarioModificacion: usuario }, { stripUnknown: true }); // sin campos de la lista (idTipo…)
    if (error) {
      return res.status(400).json({ ok: false, msg: error.details[0].message });
    }

    const tipoRole = await service.crearTipoPestana(value);
    return res.status(201).json({ ok: true, tipoRole });
  } catch (error) {
    return responderError(res, error, 'tipos-pestana'); // CC-141: registra los 5xx y traduce los de la base
  }
};

const actualizarTipoPestana = async (req, res) => {
  try {
    const { error, value } = TipoPestanaSchema.validate({ ...req.body, codigoUsuarioModificacion: req.codigoUsuario || req.body.codigoUsuarioModificacion }, { stripUnknown: true }); // CC-141: auditoría del token
    if (error) {
      return res.status(400).json({ ok: false, msg: error.details[0].message });
    }

    const tipoRole = await service.actualizarTipoPestana(req.params.id, value);
    return res.status(200).json({ ok: true, tipoRole });
  } catch (error) {
    return responderError(res, error, 'tipos-pestana'); // CC-141: registra los 5xx y traduce los de la base
  }
};

const eliminarTipoPestana = async (req, res) => {
  try {
    const result = await service.eliminarTipoPestana(req.params.id);
    return res.status(200).json({ ok: true, msg: result.msg });
  } catch (error) {
    return responderError(res, error, 'tipos-pestana'); // CC-141: registra los 5xx y traduce los de la base
  }
};

module.exports = {
  getTiposPestana,
  getTipoPestanaById,
  crearTipoPestana,
  actualizarTipoPestana,
  eliminarTipoPestana
};