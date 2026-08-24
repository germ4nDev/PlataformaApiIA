/*
    Author: German Valencia
    Service: AnthropicAnalysisService
    Descripción: Servicio de Agentes de IA para micro-análisis de widgets, 
                 enriquecido con contexto del mundo real (APIs externas).
    Pattern: TORRE_CONTROL Agentic UI
*/
const { Anthropic } = require('@anthropic-ai/sdk');
const ExternalApi = require('./external-integration.service');

// Inicializamos el cliente de Anthropic con la API Key de las variables de entorno
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const analizarDatosWidget = async (widgetId, rawData) => {
  try {
    // 1. Obtener contexto del mundo real en paralelo (súper rápido gracias al caché de Node-Cache)
    const [clima, festivos, vias, trm] = await Promise.all([
      ExternalApi.getOceanographicData(),
      ExternalApi.getHolidays(),
      ExternalApi.getRoadStatus(),
      ExternalApi.getTRM()
    ]);

    // 2. Procesar y formatear el contexto externo para que la IA lo entienda
    const hoy = new Date().toISOString().split('T')[0];
    const esFestivo = (festivos && festivos.some(f => f.date === hoy)) ? "SÍ" : "NO";
    const numAlertasViales = vias ? vias.length : 0;
    const valorDolar = trm ? trm.valor : 'Desconocido';

    // Construimos la cadena de contexto que le dará "consciencia" al Agente IA
    const contextExterno = `
            [CONTEXTO DEL MUNDO REAL HOY]:
            - Clima/Océano: ${clima ? 'Datos oceánicos registrados' : 'Condiciones normales'}
            - ¿Es Festivo en Colombia?: ${esFestivo}
            - Alertas Viales (INVIAS): ${numAlertasViales} reportes activos cerca al nodo.
            - TRM (Dólar): ${valorDolar} COP
        `.trim();

    // 3. Convertir la data cruda del widget a un string ligero
    // Nota: rawData trae los números de la base de datos SQL que el widget está mostrando
    const dataString = JSON.stringify(rawData);

    // 4. Enrutador de Prompts (Agentes especializados por Widget)
    let systemPrompt = "";
    let userPrompt = "";

    switch (widgetId) {
      case 'KPI_CONTENEDORES':
        systemPrompt = `Eres un controlador de patio portuario experto. Considera el siguiente contexto externo: ${contextExterno}`;
        userPrompt = `Analiza estos KPIs de contenedores y dime en máximo 2 líneas si hay riesgo de congestión y qué factor (interno o externo) lo podría causar: ${dataString}`;
        break;

      case 'CHART_PRODUCTIVIDAD':
        systemPrompt = `Eres un analista de rendimiento logístico. Considera el siguiente contexto externo: ${contextExterno}`;
        userPrompt = `Revisa esta matriz de movimientos por hora por terminal. Indica la hora de menor rendimiento y si el contexto externo (ej. clima, festivo o vías) pudo influir. Sé muy breve: ${dataString}`;
        break;

      case 'CONDICIONES_CANAL':
        systemPrompt = `Eres un capitán de puerto evaluando riesgos de zarpe/atraque. Considera el siguiente contexto externo: ${contextExterno}`;
        userPrompt = `Basado en estas métricas de marea, visibilidad y el clima actual, ¿es seguro el tránsito de buques Panamax hoy? Responde en 2 viñetas concisas: ${dataString}`;
        break;

      case 'RESUMEN_SEMANAL':
        systemPrompt = `Eres un gerente de operaciones logísticas. Considera el siguiente contexto externo: ${contextExterno}`;
        userPrompt = `Analiza este resumen semanal y la TRM actual. Dame 1 conclusión ejecutiva sobre cómo el precio del dólar o los festivos impactaron los volúmenes: ${dataString}`;
        break;

      default:
        systemPrompt = `Eres un asistente logístico de la Torre de Control QPLUS. Contexto actual: ${contextExterno}`;
        userPrompt = `Resume este paquete de datos operativos en una oración clara y profesional: ${dataString}`;
    }

    // 5. Ejecutar la llamada a Anthropic (Claude 3 Haiku)
    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307", // Haiku es la elección correcta: respuestas en milisegundos y costo ultra bajo
      max_tokens: 150, // Limitamos para que el texto encaje perfectamente en el diseño de la tarjeta
      temperature: 0.2, // Baja temperatura para mantener las respuestas objetivas, analíticas y sin "alucinaciones"
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userPrompt
        }
      ]
    });

    // 6. Retornar la conclusión generada por la IA
    return response.content[0].text;

  } catch (error) {
    console.error(`[QPLUS AI] Error procesando widget ${widgetId}:`, error.message);
    // Fallback elegante para que el front-end no se rompa si la API falla
    return "El agente de análisis está analizando la telemetría. Intente nuevamente en unos minutos.";
  }
};

module.exports = { analizarDatosWidget };