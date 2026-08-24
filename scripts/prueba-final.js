const Anthropic = require('@anthropic-ai/sdk');

// Inyectamos la llave directamente para evitar problemas con dotenv
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_KEY,
});

async function testConnection() {

  try {
    const msg = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 100,
      messages: [{ role: "user", content: "Hola, responde únicamente con la palabra 'CONECTADO'." }]
    });

  } catch (err) {
    console.error("❌ ERROR CRÍTICO:");
    console.error("Código de estado:", err.status);
    console.error("Detalle del error:", err.error ? err.error : err.message);
  }
}

testConnection();