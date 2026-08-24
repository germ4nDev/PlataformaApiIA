/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Audit Standards
*/
const { response } = require("express");
const UsuariosRolesService = require("../services/usuarios-roles.service");

const service = new UsuariosRolesService();

const getUsuariosRoles = async (req, res = response) => {
  try {
    const usuariosRoles = await service.getUsuariosRoles();
    return res.status(200).json({ ok: true, usuariosRoles });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error interno al obtener la lista de usuarios y roles."
    });
  }
};

const getUsuarioRoleById = async (req, res = response) => {
  try {
    const { id } = req.params;
    const usuarioRoles = await service.getUsuarioRoleById(id);
    return res.status(200).json({ ok: true, usuarioRoles });
  } catch (error) {
    return res.status(error.statusCode || 404).json({
      ok: false,
      msg: error.msg || "Error al obtener la relación solicitada."
    });
  }
};



const getUsuariosByRoleCode = async (req, res = response) => {
  try {
    const { codigoRole } = req.params;
    const usuariosRoles = await service.getUsuariosByRoleCode(codigoRole);
    return res.status(200).json({ ok: true, usuariosRoles });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error al obtener usuarios por código de rol."
    });
  }
};

const getRolesPorUsuarioYEmpresa = async (req, res) => {
  // Extraemos ambos códigos de los parámetros de la ruta
  const { codigoUsuarioSC, codigoEmpresaSC } = req.params;

  try {
    const usuariosRoles = await service.obtenerPorUsuarioYEmpresa(
      codigoUsuarioSC,
      codigoEmpresaSC
    );

    res.json({
      ok: true,
      usuariosRoles
    });

  } catch (error) {
    console.error('Error en getRolesPorUsuarioYEmpresa:', error);
    res.status(500).json({
      ok: false,
      msg: 'Error inesperado al consultar los roles por empresa. Hable con el administrador'
    });
  }
};

const getRolesByUser = async (req, res = response) => {
  try {
    const { codigoUsuarioSC } = req.params;
    const usuariosRoles = await service.getRolesByUserId(codigoUsuarioSC);
    return res.status(200).json({ ok: true, usuariosRoles });
  } catch (error) {
    return res.status(error.statusCode || 404).json({
      ok: false,
      msg: error.msg || "Error al obtener roles por usuario."
    });
  }
};

const createUsuarioRole = async (req, res = response) => {
  try {
    const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';
    const dataDTO = { ...req.body, codigoUsuario: usuarioAccion };

    const usuarioRoles = await service.createUsuarioRole(dataDTO);
    return res.status(201).json({ ok: true, usuarioRoles });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al crear la relación usuario-rol."
    });
  }
};

const syncRoleUsers = async (req, res = response) => {
  try {
    const { id } = req.params;
    const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';

    // Hidratación del DTO para operaciones masivas
    const dataDTO = {
      ...req.body,
      usuarioModificacion: usuarioAccion
    };

    const usuarioRoles = await service.updateRoleAndUsers(id, dataDTO.datosRol, dataDTO.usuariosSeleccionados);
    return res.status(200).json({ ok: true, usuarioRoles });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error al sincronizar usuarios con el rol."
    });
  }
};

const syncUserRoles = async (req, res = response) => {
  try {
    const { id } = req.params;
    const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';

    const dataDTO = {
      ...req.body,
      codigoUsuarioModificacion: usuarioAccion
    };

    const usuariosRoles = await service.updateUserAndRoles(id, dataDTO.datosUsuario, dataDTO.rolesSeleccionados);
    return res.status(200).json({ ok: true, usuariosRoles });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error al sincronizar roles para el usuario."
    });
  }
};

const deleteUsuarioRole = async (req, res = response) => {
  try {
    const { id } = req.params;
    await service.deleteUsuarioRole(id);
    return res.status(200).json({ ok: true, msg: "Relación eliminada correctamente." });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al eliminar la relación."
    });
  }
};

const deleteAllUsersByRole = async (req, res = response) => {
  try {
    const { id } = req.params;
    await service.deleteAllUsersByRole(id);
    return res.status(200).json({ ok: true, msg: "Usuarios removidos del rol exitosamente." });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error al remover usuarios del rol."
    });
  }
};

const deleteAllRolesByUser = async (req, res = response) => {
  try {
    const { id } = req.params;
    await service.deleteAllRolesByUser(id);
    return res.status(200).json({ ok: true, msg: "Roles removidos del usuario exitosamente." });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error al remover roles del usuario."
    });
  }
};

module.exports = {
  getUsuariosRoles,
  getUsuarioRoleById,
  getUsuariosByRoleCode,
  getRolesPorUsuarioYEmpresa,
  getRolesByUser,
  createUsuarioRole,
  syncRoleUsers,
  syncUserRoles,
  deleteUsuarioRole,
  deleteAllUsersByRole,
  deleteAllRolesByUser
};