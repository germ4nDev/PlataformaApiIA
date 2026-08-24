/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Error Handling
*/
const { response } = require("express");
const RolesService = require("../services/roles.service");

const service = new RolesService();

const getRoles = async (req, res = response) => {
  try {
    const roles = await service.getRoles();
    return res.status(200).json({ ok: true, roles });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error interno al obtener los roles."
    });
  }
};

const getRoleById = async (req, res = response) => {
  try {
    const { id } = req.params;
    const role = await service.getRoleById(id);
    return res.status(200).json({ ok: true, role });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al obtener el rol solicitado."
    });
  }
};

const getRolesByApp = async (req, res = response) => {
  try {
    const { appCode } = req.params;
    const roles = await service.getRolesByAppCode(appCode);
    return res.status(200).json({ ok: true, roles });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al obtener los roles por aplicación."
    });
  }
};

const createRole = async (req, res = response) => {
  try {
    // QPLUS: Inyección de auditoría
    const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';
    const dataDTO = { ...req.body, codigoUsuario: usuarioAccion };

    const role = await service.createRole(dataDTO);
    return res.status(201).json({ ok: true, role });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al crear el rol."
    });
  }
};

const updateRole = async (req, res = response) => {
  try {
    const { id } = req.params;

    // QPLUS: Hidratación del payload de auditoría
    const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';
    const dataDTO = { ...req.body, codigoUsuario: usuarioAccion };

    const role = await service.updateRole(id, dataDTO);
    return res.status(200).json({ ok: true, role });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al actualizar el rol."
    });
  }
};

const deleteRole = async (req, res = response) => {
  try {
    const { id } = req.params;
    await service.deleteRole(id);

    return res.status(200).json({
      ok: true,
      msg: "Rol eliminado correctamente."
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al eliminar el rol."
    });
  }
};

module.exports = {
  getRoles,
  getRoleById,
  getRolesByApp,
  createRole,
  updateRole,
  deleteRole
};