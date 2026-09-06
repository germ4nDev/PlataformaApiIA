const TiposRoleService = require('../services/tipos-role.service');
const { TipoRoleSchema } = require('../models/tipo-role.model');

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
    return res.status(error.statusCode || 500).json({ ok: false, msg: error.msg || 'Error interno' });
  }
};

const crearTipoRole = async (req, res) => {
  try {
    const { error, value } = TipoRoleSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ ok: false, msg: error.details[0].message });
    }

    const tipoRole = await service.crearTipoRole(value);
    return res.status(201).json({ ok: true, tipoRole });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ ok: false, msg: error.msg || 'Error interno' });
  }
};

const actualizarTipoRole = async (req, res) => {
  try {
    const { error, value } = TipoRoleSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ ok: false, msg: error.details[0].message });
    }

    const tipoRole = await service.actualizarTipoRole(req.params.id, value);
    return res.status(200).json({ ok: true, tipoRole });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ ok: false, msg: error.msg || 'Error interno' });
  }
};

const eliminarTipoRole = async (req, res) => {
  try {
    const result = await service.eliminarTipoRole(req.params.id);
    return res.status(200).json({ ok: true, msg: result.msg });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ ok: false, msg: error.msg || 'Error interno' });
  }
};

module.exports = {
  getTiposRole,
  getTipoRoleById,
  crearTipoRole,
  actualizarTipoRole,
  eliminarTipoRole
};