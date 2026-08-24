const Anthropic = require('@anthropic-ai/sdk');

// Inyectamos la llave directamente para evitar problemas con dotenv
const anthropic = new Anthropic({
  apiKey: "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",
});

async function testConnection() {
  console.log("⏳ Iniciando prueba de conexión...");

  try {
    const msg = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 100,
      messages: [{ role: "user", content: "Hola, responde únicamente con la palabra 'CONECTADO'." }]
    });

    console.log("✅ ÉXITO ABSOLUTO. Respuesta de Claude:", msg.content[0].text);

  } catch (err) {
    console.error("❌ ERROR CRÍTICO:");
    console.error("Código de estado:", err.status);
    console.error("Detalle del error:", err.error ? err.error : err.message);
  }
}

testConnection();