/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Error Handling
*/
const { response } = require("express");
const PdfService = require("../services/pdf.service");

const service = new PdfService();

const generatePdf = async (req, res = response) => {
    try {
        // QPLUS: El controlador prepara el payload. 
        // Si el servicio requiere auditoría, inyectamos el contexto aquí.
        const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';
        const dataDTO = { ...req.body, codigoUsuario: usuarioAccion };

        // Delegación de validación y lógica al servicio
        const resultadoPdf = await service.generatePdf(dataDTO);

        // QPLUS: Respuesta estándar, devolviendo el objeto resultante en 'respuesta'
        return res.status(200).json({
            ok: true,
            respuesta: {
                msg: "PDF generado exitosamente.",
                ...resultadoPdf
            }
        });
    } catch (error) {
        // Propagación estándar de errores sin ensuciar logs de consola
        return res.status(error.statusCode || 500).json({
            ok: false,
            msg: error.msg || "Error interno al procesar la generación del PDF.",
            detalles: error.detalle || error.message || null
        });
    }
};

module.exports = {
    generatePdf
};