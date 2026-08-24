/* controllers/tcl-ingesta.controller.js */
const pdf = require('pdf-parse');
const xlsx = require('xlsx');
const iaAssistantService = require('../../services/ia-assistant.service');
const mockAgentsService = require('../../services/torre-control/mock-agents.service');
const { io } = require('../index');

class TclIngestaController {

  async procesarDocumento(req, res) {
    try {
      const file = req.file;
      const { tipoDocumento } = req.body; // 'BOLETIN_PORTUARIO' o 'RNDC_EXCEL'

      if (!file) return res.status(400).json({ ok: false, msg: "No se subió ningún archivo." });
      if (!tipoDocumento) return res.status(400).json({ ok: false, msg: "Falta el tipoDocumento." });

      let textoCrudo = '';

      // 1. EXTRAER TEXTO SEGÚN EL TIPO DE ARCHIVO
      if (file.mimetype === 'application/pdf') {
        const pdfData = await pdf(file.buffer);
        textoCrudo = pdfData.text;
      }
      else if (file.mimetype.includes('spreadsheetml') || file.mimetype.includes('excel')) {
        const workbook = xlsx.read(file.buffer, { type: 'buffer' });
        // Tomamos la primera hoja y la convertimos a texto (CSV)
        const sheetName = workbook.SheetNames[0];
        textoCrudo = xlsx.utils.sheet_to_csv(workbook.Sheets[sheetName]);
      }
      else {
        return res.status(400).json({ ok: false, msg: "Formato no soportado. Usa PDF o Excel." });
      }

      // 2. ENVIAR A LA IA PARA INTERPRETACIÓN ESTRUCTURADA
      // console.log(`🤖 Iniciando interpretación IA de ${file.originalname}...`);
      const respuestaIA = await iaAssistantService.interpretarDocumentoLogistico(textoCrudo, tipoDocumento);

      if (!respuestaIA.ok) {
        return res.status(500).json({ ok: false, msg: "Fallo en la interpretación de la IA." });
      }

      // 3. GUARDAR EL JSON RESULTANTE EN EL BACKEND (MOCK)
      await mockAgentsService.actualizarDatosMock(tipoDocumento, respuestaIA.data);

      // 4. EMITIR EVENTO WEBSOCKET PARA ACTUALIZAR EL TABLERO
      io.emit('tablero_actualizado', {
        tipo: tipoDocumento,
        mensaje: `Nuevos datos de ${tipoDocumento} procesados por IA.`,
        data: respuestaIA.data
      });

      return res.json({
        ok: true,
        msg: "Documento procesado, tablero actualizado en tiempo real.",
        data: respuestaIA.data
      });

    } catch (error) {
      // console.error("🔴 Error en TclIngestaController:", error);
      res.status(500).json({ ok: false, msg: "Error interno procesando el documento." });
    }
  }
}

module.exports = new TclIngestaController();