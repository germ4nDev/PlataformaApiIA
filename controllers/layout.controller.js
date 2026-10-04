/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection, Audit Standards & Metadata-Driven Layouts
*/
const { response } = require("express");
const LayoutService = require("../services/layout.service");
const { PlantillaLayoutDTO } = require('../models/plantilla-layout.dto');
const Joi = require('joi');

const service = new LayoutService();

// ==========================================
// --- CONTROLADORES WIDGETS ---
// ==========================================
const getLayouts = async (req, res = response) => {
  try {
    const layouts = await service.getLayouts();
    return res.status(200).json({ ok: true, layout: layouts });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false, msg: error.msg || "Error interno al obtener los layouts."
    });
  }
};

// const getPlantillaMaestra = async (req, res = response) => {
//   try {
//     const { codigoUsuario, codigoPestana } = req.params;
//     const layouts = await service.getPlantillaMaestra(codigoPestana);
//     return res.status(200).json({ ok: true, layout: layouts });
//   } catch (error) {
//     return res.status(error.statusCode || 500).json({
//       ok: false, msg: error.msg || "Error interno al obtener el layout del usuario."
//     });
//   }
// };

const getLayoutByUsuario = async (req, res = response) => {
  try {
    const { codigoUsuario, codigoPestana } = req.params;
    const layouts = await service.getLayoutByUsuario(codigoUsuario, codigoPestana);
    return res.status(200).json({ ok: true, layout: layouts });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false, msg: error.msg || "Error interno al obtener el layout del usuario."
    });
  }
};

const saveOrUpdateLayout = async (req, res = response) => {
  try {
    const layoutGuardado = await service.saveLayout(req.body);
    return res.status(200).json({
      ok: true, msg: "Layout guardado exitosamente.", layout: layoutGuardado
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false, msg: error.msg || "Error al guardar el layout.", detalles: error.details || null
    });
  }
};

// ==========================================
// --- CONTROLADORES PESTAÑAS ---
// ==========================================
const getPestanasUsuario = async (req, res = response) => {
  try {
    const { codigoUsuario } = req.params;
    const pestanas = await service.getPestanasByUsuario(codigoUsuario);
    return res.status(200).json({ ok: true, data: pestanas });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false, msg: error.msg || "Error interno al obtener pestañas del usuario."
    });
  }
};

const getPlantillaMaestra = async (req, res = response) => {
  try {
    const { codigoPestana } = req.params;

    // Llamamos al servicio que armamos en la Fase 1
    const plantilla = await service.getPlantillaMaestra(codigoPestana);

    res.json({
      ok: true,
      layout: plantilla // Retornamos el layout estructurado
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      ok: false,
      msg: 'Hable con el administrador. Error al obtener plantilla maestra.'
    });
  }
}

const savePestanasUsuario = async (req, res = response) => {
  try {
    const datosRaw = req.body;
    console.log('datos pestanas', datosRaw);

    const pestanasGuardadas = await service.savePestanasUsuario(datosRaw);
    return res.status(200).json({
      ok: true, msg: "Preferencias de pestañas guardadas.", data: pestanasGuardadas
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false, msg: error.msg || "Error al guardar pestañas.", detalles: error.details || null
    });
  }
};

const eliminarLayoutPorPestana = async (req, res) => {
  try {
    const { codigoUsuario, codigoPestana } = req.params;

    if (!codigoUsuario || !codigoPestana) {
      return res.status(400).json({
        success: false,
        message: "Se requieren los parámetros codigoUsuario y codigoPestana"
      });
    }

    const registrosEliminados = await service.eliminarLayoutPorPestana(codigoUsuario, codigoPestana);

    return res.status(200).json({
      success: true,
      message: `Se restauró la pestaña ${codigoPestana} para el usuario ${codigoUsuario}`,
      data: { eliminados: registrosEliminados }
    });

  } catch (error) {
    console.error("❌ Error en el controlador eliminarLayoutPorPestana:", error);
    return res.status(500).json({
      success: false,
      message: "Ocurrió un error en el servidor al intentar limpiar el tablero.",
      error: error.message
    });
  }
};

// ==========================================
// --- MOTOR DE PLANTILLAS METADATA-DRIVEN ---
// ==========================================

const obtenerPlantillaPestana = async (req, res = response) => {
  try {
    const { codigoPestana } = req.params;

    // 1. Validación de entrada con Joi
    const schema = Joi.string().required();
    const { error } = schema.validate(codigoPestana);
    if (error) {
      return res.status(400).json({
        ok: false,
        msg: 'El código de la pestaña es inválido o requerido.'
      });
    }

    // 2. Ejecución en la capa de servicio
    const dataCruda = await service.getPlantillaMaestra(codigoPestana);

    if (!dataCruda) {
      return res.status(404).json({
        ok: false,
        msg: `No se encontró plantilla maestra para la pestaña ${codigoPestana}`
      });
    }

    // 3. Transformación DTO para Angular
    const jsonAngular = PlantillaLayoutDTO.formatearRespuesta(dataCruda);

    // 4. Respuesta HTTP exitosa
    return res.status(200).json({
      ok: true,
      data: jsonAngular
    });

  } catch (error) {
    console.error("❌ Error en el controlador obtenerPlantillaPestana:", error);
    return res.status(500).json({
      ok: false,
      msg: 'Error interno al consultar la plantilla maestra del tablero.',
      error: error.message
    });
  }
};

const guardarConfiguracionMaestra = async (req, res = response) => {
  try {
    const { codigoPestana } = req.params;
    const payloadConfig = req.body;

    // Aquí podrías agregar validación Joi del payloadConfig si lo deseas
    if (!codigoPestana || !payloadConfig.codigoTipo) {
      return res.status(400).json({
        ok: false,
        msg: "codigoPestana y codigoTipo son obligatorios."
      });
    }

    await service.saveConfiguracionMaestra(codigoPestana, payloadConfig);

    return res.status(200).json({
      ok: true,
      msg: "Configuración maestra de la pestaña guardada exitosamente."
    });

  } catch (error) {
    console.error("❌ Error en el controlador guardarConfiguracionMaestra:", error);
    return res.status(500).json({
      ok: false,
      msg: 'Error interno al guardar la configuración maestra.',
      error: error.message
    });
  }
};

module.exports = {
  getLayouts,
  getLayoutByUsuario,
  saveOrUpdateLayout,
  getPestanasUsuario,
  savePestanasUsuario,
  eliminarLayoutPorPestana,
  // Exportamos los nuevos métodos
  getPlantillaMaestra,
  guardarConfiguracionMaestra
};