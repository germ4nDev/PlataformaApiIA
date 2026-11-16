/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Error Handling
*/
const { response } = require("express");
const EstadoService = require("../services/estados.service");

const service = new EstadoService();

const getEstados = async (req, res = response) => {
  try {
    const estados = await service.getEstados();
    return res.status(200).json({ ok: true, estados });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error interno al obtener los estados.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

const getEstadoById = async (req, res = response) => {
  try {
    const { id } = req.params;
    const estado = await service.getEstadoPorId(id);
    return res.status(200).json({ ok: true, estado });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al obtener el estado solicitado.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

const createEstado = async (req, res = response) => {
  try {
    // QPLUS: Inyección de auditoría para trazabilidad
    const usuarioAccion = req.codigoUsuario || 'SISTEMA'; // CC-137: del token (validarJWT)
    const dataDTO = { ...req.body, codigoUsuarioCreacion: usuarioAccion, codigoUsuarioModificacion: usuarioAccion };

    const estado = await service.createEstado(dataDTO);
    return res.status(201).json({ ok: true, estado });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al crear el estado.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

const updateEstado = async (req, res = response) => {
  try {
    const { id } = req.params;

    // QPLUS: Hidratación del payload de auditoría
    const usuarioAccion = req.codigoUsuario || 'SISTEMA'; // CC-137: del token (validarJWT)
    const dataDTO = { ...req.body, codigoUsuarioModificacion: usuarioAccion };

    const estado = await service.updateEstado(id, dataDTO);
    return res.status(200).json({ ok: true, estado });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al actualizar el estado.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

const deleteEstado = async (req, res = response) => {
  try {
    const { id } = req.params;
    await service.deleteEstado(id);

    return res.status(200).json({
      ok: true,
      msg: "Estado eliminado correctamente."
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al eliminar el estado.",
      errores: error.details // CC-137: detalle del Joi
    });
  }
};

// CC-204 (Utilidades › Catálogos): obtener y escribir por capas (services/plataforma/catalogos.service.js: validación, código que no se
// repite ni cambia, no inactiva ni elimina lo que otras tablas usan, socket de siempre y catalogos-actualizados). Mismas rutas y
// permisos; la respuesta trae `registro` y conserva la forma anterior.
const Catalogo = require('./plataforma/catalogos.controller').para('estados', (r) => ({ estado: r }));

module.exports = {
  getEstados,
  getEstadoById: Catalogo.obtener,
  createEstado: Catalogo.crear,
  updateEstado: Catalogo.modificar,
  deleteEstado: Catalogo.eliminar
};
