/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Error Handling
*/
const { response } = require("express");
const EmpresaSCService = require("../services/empresas-sc.service");

const service = new EmpresaSCService();

const getEmpresasSC = async (req, res = response) => {
  try {
    const empresasSC = await service.getEmpresasSC();
    return res.status(200).json({ ok: true, empresasSC });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error interno al obtener empresas suscriptoras."
    });
  }
};

const getEmpresaSCById = async (req, res = response) => {
  try {
    const { id } = req.params;
    const empresaSC = await service.getEmpresaSCById(id);
    return res.status(200).json({ ok: true, empresaSC });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al obtener la empresa suscriptora."
    });
  }
};

const createEmpresaSC = async (req, res = response) => {
  try {
    // QPLUS: Inyección de auditoría
    const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';
    const dataDTO = { ...req.body, codigoUsuario: usuarioAccion };

    const empresaSC = await service.createEmpresaSC(dataDTO);
    return res.status(201).json({ ok: true, empresaSC });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al crear la empresa suscriptora."
    });
  }
};

const updateEmpresaSC = async (req, res = response) => {
  try {
    const { id } = req.params;

    // QPLUS: Hidratación del payload
    const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';
    const dataDTO = { ...req.body, codigoUsuario: usuarioAccion };

    const empresaSC = await service.updateEmpresaSC(id, dataDTO);
    return res.status(200).json({ ok: true, empresaSC });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al actualizar la empresa suscriptora."
    });
  }
};

const deleteEmpresaSC = async (req, res = response) => {
  try {
    const { id } = req.params;
    await service.deleteEmpresaSC(id);

    return res.status(200).json({
      ok: true,
      msg: "Empresa eliminada correctamente."
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al eliminar la empresa suscriptora."
    });
  }
};

module.exports = {
  getEmpresasSC,
  getEmpresaSCById,
  createEmpresaSC,
  updateEmpresaSC,
  deleteEmpresaSC
};