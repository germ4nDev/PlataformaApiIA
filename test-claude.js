require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function testConnection() {
  console.log("Iniciando prueba con la API Key:", process.env.ANTHROPIC_API_KEY ? "Cargada OK" : "NO ENCONTRADA");

  try {
    const msg = await anthropic.messages.create({
      model: "claude-3-haiku-20240307", // Usamos Haiku para garantizar acceso
      max_tokens: 100,
      messages: [{ role: "user", content: "Hola, responde solo con la palabra 'Conectado'." }]
    });
    console.log("✅ ÉXITO. Respuesta de Claude:", msg.content[0].text);
  } catch (err) {
    console.error("❌ ERROR CRÍTICO:", err.status, err.error ? err.error : err.message);
  }
}

testConnection();