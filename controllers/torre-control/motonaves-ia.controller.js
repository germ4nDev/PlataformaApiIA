/*
    Author: German Valencia
    Pattern: PORTTOS Controller Pattern - Dashboard IA
*/
const MotonavesIAService = require('../../services/torre-control/motonaves-ia.service');

class MotonavesIAController {

  /**
   * Obtiene el análisis generado por IA para el widget de Motonaves 72H
   */
  async obtenerReporte72H(req, res) {
    try {
      // El servicio se encarga de todo: consultar BD, armar DTO, llamar a Claude y validar con Joi.
      const reporteValidado = await MotonavesIAService.generarDashboardMotonaves();

      // Retornamos HTTP 200 con el JSON inmaculado
      return res.status(200).json({
        success: true,
        message: 'Análisis IA completado exitosamente.',
        // Extraemos directamente el objeto que Angular espera mapear en 'this.dataTerminal = respuestaJSON.data'
        data: reporteValidado
      });

    } catch (error) {
      // console.error('[IA-CONTROLLER] Fallo en la inferencia o validación:', error.message);

      // EL FALLBACK DE SEGURIDAD (Contingencia Operativa)
      // Devolvemos un HTTP 200 para que Angular procese la respuesta normalmente,
      // pero con el flag success en false y una data degradada por defecto.
      return res.status(200).json({
        success: false,
        message: 'Modo degradado activo.',
        data: {
          widgetId: "MOTONAVES_72H",
          titulo: "REPORTE DE MOTONAVES - 72H",
          subtitulo: "Análisis IA temporalmente fuera de línea",
          data: {
            barcos: [
              {
                nombre: "SISTEMA AISLADO",
                terminal: "N/A",
                estado_operativo: "SIN CONEXIÓN",
                badge_class: "badge-danger",
                alerta_calado: false,
                observacion_ia: "El motor de inteligencia analítica no pudo procesar las reglas del puerto en este momento."
              }
            ]
          }
        }
      });
    }
  }
}

module.exports = new MotonavesIAController();