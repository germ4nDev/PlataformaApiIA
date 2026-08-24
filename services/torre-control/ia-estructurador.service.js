/*
    Author: German Valencia
    Service: AgenteEstructuradorIA
    Descripción: Motor genérico para procesar telemetría, aplicar reglas de negocio 
                 mediante LLMs y retornar respuestas estrictamente tipeadas en JSON.
    Pattern: QPLUS Agentic UI - Data to Data
*/
const { Anthropic } = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

/**
 * Función genérica para forzar a Claude a retornar una estructura de datos.
 * * @param {Object} params Parámetros de configuración del agente
 * @param {any} params.rawData Los datos duros provenientes de SQL (Array u Objeto)
 * @param {string} params.contextoExterno Contexto del mundo real (Clima, Vías, etc.)
 * @param {string} params.instruccionesAnalisis Lo que quieres que la IA evalúe o calcule
 * @param {string} params.estructuraEsperada Un string simulando la interfaz/JSON esperado
 * @param {any} params.fallbackData Qué devolver si la IA falla o el API se cae
 * @returns {Promise<any>} Objeto o Array JSON parseado
 */
const generarEstructuraIA = async ({
  rawData,
  contextoExterno = "Sin contexto adicional",
  instruccionesAnalisis,
  estructuraEsperada,
  fallbackData = []
}) => {

  const dataString = JSON.stringify(rawData);

  // 1. El System Prompt Blindado (Inyección de reglas estrictas)
  const systemPrompt = `
        Eres un motor de cómputo analítico en una Torre de Control Logística.
        
        REGLA CRÍTICA DE SISTEMA: 
        Tu única función es recibir datos, procesarlos y escupir un objeto JSON válido.
        No eres un asistente conversacional. No incluyas saludos, ni explicaciones previas o posteriores.
        No utilices bloques de código Markdown (no uses \`\`\`json).
        
        Debes retornar EXACTAMENTE la siguiente estructura de datos:
        ${estructuraEsperada}
    `;

  const userPrompt = `
        [CONTEXTO EXTERNO]: ${contextoExterno}
        
        [DATOS DE ENTRADA]: 
        ${dataString}
        
        [INSTRUCCIONES DE PROCESAMIENTO]:
        ${instruccionesAnalisis}
        
        Genera el JSON ahora:
    `;

  try {
    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307", // Rápido, económico y excelente siguiendo formatos
      max_tokens: 1500, // Margen amplio para arrays largos
      temperature: 0.1, // Temperatura casi 0 para evitar alucinaciones en el formato
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }]
    });

    let textoRespuesta = response.content[0].text;

    // 2. Sanitización extrema: Eliminar basura que pueda romper el JSON.parse
    textoRespuesta = textoRespuesta.replace(/```json/gi, '');
    textoRespuesta = textoRespuesta.replace(/```/g, '');
    textoRespuesta = textoRespuesta.trim();

    // 3. Transformación a objeto nativo de JavaScript
    const resultadoEstructurado = JSON.parse(textoRespuesta);

    return resultadoEstructurado;

  } catch (error) {
    // console.error(`[QPLUS Agente Genérico] Error de IA o Parseo:`, error.message);
    // console.error(`[QPLUS Agente Genérico] Respuesta cruda que falló:`, textoRespuesta);

    // Retorna el dato de seguridad para no romper la tabla en Angular
    return fallbackData;
  }
};

module.exports = { generarEstructuraIA };