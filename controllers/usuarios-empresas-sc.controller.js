/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Audit Standards
*/
const { response } = require("express");
const UsuariosEmpresasSCService = require("../services/usuarios-empresas-sc.service");

const service = new UsuariosEmpresasSCService();

const getUsuariosEmpresas = async (req, res = response) => {
  try {
    const usuariosSC = await service.getUsuariosEmpresas();

    return res.status(200).json({ ok: true, usuariosSC });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error interno al obtener los usuariosSC de usuarios-empresas.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

const getUsuarioEmpresaById = async (req, res = response) => {
  try {
    const { id } = req.params;
    const usuarioSC = await service.getUsuarioEmpresaById(id);
    return res.status(200).json({ ok: true, usuarioSC });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al obtener la relación solicitada.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

const createUsuarioEmpresa = async (req, res = response) => {
  try {
    // QPLUS: Inyección de auditoría
    const usuarioAccion = req.codigoUsuario || 'SISTEMA'; // CC-137: del token (validarJWT)
    const dataDTO = { ...req.body, codigoUsuarioCreacion: usuarioAccion, codigoUsuarioModificacion: usuarioAccion };

    const usuarioSC = await service.createUsuarioEmpresa(dataDTO);
    return res.status(201).json({ ok: true, usuarioSC });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al crear la relación usuario-empresa.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

const updateUsuarioEmpresa = async (req, res = response) => {
  try {
    const { id } = req.params;

    // QPLUS: Hidratación del payload de auditoría
    const usuarioAccion = req.codigoUsuario || 'SISTEMA'; // CC-137: del token (validarJWT)
    const dataDTO = { ...req.body, codigoUsuarioModificacion: usuarioAccion };

    const usuarioSC = await service.updateUsuarioEmpresa(id, dataDTO);
    return res.status(200).json({ ok: true, usuarioSC });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al actualizar la relación usuario-empresa.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

const deleteUsuarioEmpresa = async (req, res = response) => {
  try {
    const { id } = req.params;
    await service.deleteUsuarioEmpresa(id);

    return res.status(200).json({
      ok: true,
      msg: "Relación eliminada correctamente."
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al eliminar la relación.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

module.exports = {
  getUsuariosEmpresas,
  getUsuarioEmpresaById,
  createUsuarioEmpresa,
  updateUsuarioEmpresa,
  deleteUsuarioEmpresa
};