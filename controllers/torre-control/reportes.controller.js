/*
    Author: German Valencia
    Pattern: PORTTOS Controller - Reportes operativos
*/
const { ReporteOperativoDTO } = require('../../models/torre-control/reporte-operativo.model');
const ReportesService = require('../../services/torre-control/reportes.service');
const { manejar, contextoUsuario } = require('../../helpers/controlador.helper');

/** GET ?puerto= — el widget espera un arreglo; sin puerto responde [] (como antes). */
const obtenerReportes = async (req, res) => {
  const puerto = req.query?.puerto || req.params?.puerto;
  if (!puerto) return res.json([]);
  try {
    return res.json(await ReportesService.obtenerReportesPuerto(puerto));
  } catch (error) {
    console.error('[Reportes] Error consultando reportes:', error.message);
    return res.json([]); // el widget muestra "sin reportes" en lugar de un error
  }
};

const crearReporteOperativo = manejar('Reportes.crear', async (req, res) => {
  const dto = ReporteOperativoDTO(req.body, contextoUsuario(req));
  const nuevoReporte = await ReportesService.crearReporte(dto);
  res.status(201).json({ status: 'success', data: nuevoReporte, message: 'Reporte registrado exitosamente' });
});

module.exports = { obtenerReportes, crearReporteOperativo };
