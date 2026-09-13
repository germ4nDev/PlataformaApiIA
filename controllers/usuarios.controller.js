/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Audit Standards
*/
const { response } = require("express");
const UsuariosService = require("../services/usuarios.service");

const service = new UsuariosService();

const getUsuarios = async (req, res = response) => {
  try {
    const usuarios = await service.getUsuarios();
    return res.status(200).json({ ok: true, usuarios });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error interno al obtener los usuarios."
    });
  }
};

const getUsuarioById = async (req, res = response) => {
  try {
    const { id } = req.params;
    const usuario = await service.getUsuarioById(id);
    return res.status(200).json({ ok: true, usuario });
  } catch (error) {
    return res.status(error.statusCode || 404).json({
      ok: false,
      msg: error.msg || "Error al obtener el usuario solicitado."
    });
  }
};

const validatePassword = async (req, res = response) => {
  try {
    const { codigoAdministrador, claveActual } = req.body;
    const usuario = await service.validatePassword(codigoAdministrador, claveActual);
    return res.status(200).json({ ok: true, usuario });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al validar la credencial."
    });
  }
};

const createUsuario = async (req, res = response) => {
  try {
    // QPLUS: Auditoría inicial
    const dataDTO = { ...req.body };
    console.log('usuario dto', dataDTO);

    const usuario = await service.createUsuario(dataDTO);
    console.log('usuario creado', usuario);
    return res.status(201).json({ ok: true, usuario });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al crear el usuario.",
      usuario: error.usuario || null
    });
  }
};

const uploadMasivoUsuarios = async (req, res) => {
  try {
    // 1. Verificamos si express-fileupload capturó el archivo
    if (!req.files || !req.files.archivoExcel) {
      return res.status(400).json({ ok: false, msg: 'No se detectó ningún archivo Excel.' });
    }

    // 2. Extraemos el Buffer (.data) que necesita la librería xlsx
    const archivoBuffer = req.files.archivoExcel.data;

    // express-fileupload manda los campos de texto normales en req.body
    const usuarioCreador = req.body.usuarioLogueado || 'SISTEMA';

    // 3. Enviamos el Buffer al servicio que ya tenías programado
    const resultado = await service.cargueMasivoExcel(archivoBuffer, usuarioCreador);

    return res.status(200).json({
      ok: true,
      msg: `Se importaron ${resultado.length} usuarios exitosamente.`,
    });

  } catch (error) {
    console.error('❌ Error en el cargue masivo:', error);
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || 'Error interno procesando el archivo masivo.',
      errores: error.errores,
      detalle: error.detalle || error.message
    });
  }
};

const updateUsuario = async (req, res = response) => {
  try {
    const { id } = req.params;

    // QPLUS: Hidratación del payload de auditoría
    const dataDTO = { ...req.body };

    const usuario = await service.updateUsuario(id, dataDTO);
    return res.status(200).json({ ok: true, usuario });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al actualizar el usuario."
    });
  }
};

const updateUsuarioPassword = async (req, res = response) => {
  try {
    const { id } = req.params;
    const usuario = await service.updateUsuarioPassword(id, req.body);
    return res.status(200).json({ ok: true, usuario });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al actualizar la contraseña."
    });
  }
};

const deleteUsuario = async (req, res = response) => {
  try {
    const { id } = req.params;
    await service.deleteUsuario(id);

    return res.status(200).json({
      ok: true,
      msg: "Usuario eliminado correctamente."
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al eliminar el usuario."
    });
  }
};

module.exports = {
  getUsuarios,
  getUsuarioById,
  validatePassword,
  createUsuario,
  updateUsuario,
  uploadMasivoUsuarios,
  updateUsuarioPassword,
  deleteUsuario
};