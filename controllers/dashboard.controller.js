// dashboard.controller.js
const dashboardService = require('./../services/dashboard.service');

class DashboardController {

  async obtenerUsuariosConectados(req, res) {
    try {
      const data = await dashboardService.getUsuariosConectados();
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  async obtenerKpiTotales(req, res) {
    try {
      const data = await dashboardService.getKpiTotales();
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  async obtenerPaquetesPorSuscriptor(req, res) {
    try {
      const data = await dashboardService.getPaquetesPorSuscriptor();
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  async obtenerResumenTickets(req, res) {
    try {
      const data = await dashboardService.getResumenTickets();
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  async obtenerPaquetesPorSuscriptor(req, res) {
    try {
      const data = await dashboardService.getPaquetesPorSuscriptor();
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  // 🟢 Túnel de Tickets
  async obtenerResumenTickets(req, res) {
    try {
      const data = await dashboardService.getResumenTickets();
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  // 🟢 Túnel de Facturación MRR (El nuevo para la junta)
  async obtenerFacturacionMRR(req, res) {
    try {
      const data = await dashboardService.getFacturacionMRR();
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

}

module.exports = new DashboardController();