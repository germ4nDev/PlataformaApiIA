const TiposRoleService = require('../services/tipos-role.service');
const { TipoRoleSchema } = require('../models/tipo-role.model');
const { responderError } = require('../helpers/errores.helper');

const service = new TiposRoleService();

const getTiposRole = async (req, res) => {
  try {
    const resultado = await service.obtenerTiposRole();

    return res.status(200).json({
      ok: true,
      respuesta: { msg: resultado }
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error al obtener los tipos de roles."
    });
  }
};

const getTipoRoleById = async (req, res) => {
  try {
    const tipoRole = await service.obtenerTipoRolePorId(req.params.id);
    return res.status(200).json({ ok: true, tipoRole });
  } catch (error) {
    return responderError(res, error, 'tipos-roles'); // CC-141: registra los 5xx y traduce los de la base
  }
};

const crearTipoRole = async (req, res) => {
  try {
    const usuario = req.codigoUsuario || req.body.codigoUsuarioCreacion; // CC-141: auditoría del token
    const { error, value } = TipoRoleSchema.validate({ ...req.body, codigoUsuarioCreacion: usuario, codigoUsuarioModificacion: usuario }, { stripUnknown: true }); // sin campos de la lista (idTipo…)
    if (error) {
      return res.status(400).json({ ok: false, msg: error.details[0].message });
    }

    const tipoRole = await service.crearTipoRole(value);
    return res.status(201).json({ ok: true, tipoRole });
  } catch (error) {
    return responderError(res, error, 'tipos-roles'); // CC-141: registra los 5xx y traduce los de la base
  }
};

const actualizarTipoRole = async (req, res) => {
  try {
    const { error, value } = TipoRoleSchema.validate({ ...req.body, codigoUsuarioModificacion: req.codigoUsuario || req.body.codigoUsuarioModificacion }, { stripUnknown: true }); // CC-141: auditoría del token
    if (error) {
      return res.status(400).json({ ok: false, msg: error.details[0].message });
    }

    const tipoRole = await service.actualizarTipoRole(req.params.id, value);
    return res.status(200).json({ ok: true, tipoRole });
  } catch (error) {
    return responderError(res, error, 'tipos-roles'); // CC-141: registra los 5xx y traduce los de la base
  }
};

const eliminarTipoRole = async (req, res) => {
  try {
    const result = await service.eliminarTipoRole(req.params.id);
    return res.status(200).json({ ok: true, msg: result.msg });
  } catch (error) {
    return responderError(res, error, 'tipos-roles'); // CC-141: registra los 5xx y traduce los de la base
  }
};

module.exports = {
  getTiposRole,
  getTipoRoleById,
  crearTipoRole,
  actualizarTipoRole,
  eliminarTipoRole
};