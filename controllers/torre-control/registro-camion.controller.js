/*
    Author: German Valencia
    Pattern: PORTTOS Controller Pattern - Virtual Gate
*/
const RegistroCamionService = require('../../services/torre-control/registro-camion.service');
const { RegistroCamionDTO } = require('../../models/torre-control/registro-camion.model');

class RegistroCamionController {

  // POST: Recibe el ping del camión (API expuesta a las talanqueras o GPS)
  async registrarIngresoEtapa(req, res) {
    try {
      const userContext = { codigoUsuario: req.user?.codigoUsuario || 'API_VIRTUAL_GATE' };

      // Joi purifica la entrada (ej. asegura que etapaOperativa esté entre 1 y 4)
      const dtoData = RegistroCamionDTO(req.body, userContext);

      await RegistroCamionService.registrarPingCamion(dtoData);

      return res.status(201).json({
        success: true,
        message: 'Registro de camión procesado exitosamente.'
      });

    } catch (error) {
      if (error.type === 'ValidationError') {
        return res.status(400).json({ success: false, errors: error.details });
      }
      return res.status(500).json({ success: false, message: 'Error interno del servidor.' });
    }
  }

  // GET: Endpoint para el Dashboard en Angular
  async obtenerTableroKpi(req, res) {
    try {
      const dataKpi = await RegistroCamionService.obtenerKpiCamiones();

      // Formateamos para que calce con la interfaz KpiSLA que hicimos en Angular
      return res.status(200).json({
        success: true,
        data: {
          titulo: 'CAMIONES EN OPERACIÓN',
          valor_principal: dataKpi.total.toLocaleString('es-CO'),
          subtitulo: `pre-gate ${dataKpi.pre_gate} · puerto ${dataKpi.puerto} · interior ${dataKpi.interior} · corredor ${dataKpi.corredor}`
        }
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Fallo al generar el KPI.' });
    }
  }
}

module.exports = new RegistroCamionController();