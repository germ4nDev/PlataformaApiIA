// ia-assistant.controller.js
const iaAssistantService = require('../services/ia-assistant.service');

class IaAssistantController {

  async ask(req, res) {
    try {
      const { prompt } = req.body;

      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({
          success: false,
          error: "El cuerpo de la petición debe incluir un 'prompt' de texto válido."
        });
      }

      // Llamamos a la capa de negocio. 
      // (Si tuvieras un middleware de transacciones estilo QPLUS, pasarías el objeto `req.transaction` aquí)
      const result = await iaAssistantService.processUserQuery(prompt);

      return res.status(200).json({
        success: true,
        data: result
      });

    } catch (error) {
      console.error("Error crítico en IaAssistantController:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "Error interno del servidor"
      });
    }
  }
}

module.exports = new IaAssistantController();