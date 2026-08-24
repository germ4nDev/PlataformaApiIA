/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Error Handling
*/
const { response } = require("express");
const PdfService = require("../services/pdf.service");

const service = new PdfService();

const generarReportePdf = async (req, res = response) => {
  try {
    // QPLUS: Preparación del DTO con contexto de auditoría
    const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';
    const dataDTO = {
      html: req.body.html,
      codigoUsuario: usuarioAccion
    };

    // Delegación de lógica y validación al servicio
    const resultado = await service.generatePdf(dataDTO);

    return res.status(200).json({
      ok: true,
      respuesta: resultado
    });
  } catch (error) {
    // Propagación estándar de errores con fallback para evitar respuestas vacías
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error interno al generar el reporte PDF."
    });
  }
};

module.exports = {
  generarReportePdf
};