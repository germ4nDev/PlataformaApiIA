/*
    Author: German Valencia
    Pattern: PORTTOS Adapter - Cerebro IA · Anthropic (Claude), puerto CerebroIA
    Description: Única puerta al SDK de Anthropic. No escribe en la base ni decide nada: envía la solicitud y
      devuelve la entrada de la herramienta forzada con el uso de tokens. Los reintentos, el presupuesto y el
      cortacircuito son de services/ia/cerebro.service.js (por eso el SDK va con maxRetries: 0).
      Contrato del puerto CerebroIA:
        generar({ modelo, sistema:[{texto, cache}], mensajes, herramienta, maxTokens, temperatura, timeoutMs })
          → { toolInput, toolUseId, modelo, stopReason, uso:{ entrada, salida, cacheLectura, cacheEscritura } }
        conversar({ modelo, sistema, mensajes, herramientas, eleccion, maxTokens, temperatura, timeoutMs })   (fase 5)
          → { contenido:[bloques text | tool_use], modelo, stopReason, uso }   eleccion: 'any' | { nombre } (forzada)
        Errores: { status, reintentable, message } (la llave nunca va en el mensaje).
      La llave sale de ANTHROPIC_API_KEY (.env) y no se registra.
*/
const Anthropic = require('@anthropic-ai/sdk');

class AnthropicAdapter {
  constructor() {
    this.nombre = 'anthropic';
    this.cliente = null;
  }

  _cliente() {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw { status: null, reintentable: false, message: 'Falta ANTHROPIC_API_KEY en el .env del API' };
    }
    if (!this.cliente) this.cliente = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 0 });
    return this.cliente;
  }

  _sistema(sistema = []) {
    return sistema.map((b) => ({ type: 'text', text: b.texto, ...(b.cache ? { cache_control: { type: 'ephemeral' } } : {}) }));
  }

  async _crear(cuerpo, timeoutMs) {
    try {
      return await this._cliente().messages.create(cuerpo, { timeout: timeoutMs });
    } catch (error) {
      if (error && error.reintentable !== undefined) throw error;
      const status = Number(error?.status) || null;
      throw {
        status,
        reintentable: status === 429 || status === 529 || (status >= 500 && status < 600) || /timeout|timed out|ECONNRESET|ETIMEDOUT|Connection error/i.test(error?.message || ''),
        message: `Anthropic${status ? ` ${status}` : ''}: ${String(error?.error?.error?.message || error?.message || 'error').slice(0, 400)}`,
      };
    }
  }

  /** Turno de una conversación con varias herramientas (asistente). La caché va en el sistema y en las herramientas. */
  async conversar({ modelo, sistema = [], mensajes, herramientas, eleccion = 'any', maxTokens = 1800, temperatura = 0.2, timeoutMs = 60000 }) {
    const tools = herramientas.map((h, i) => (i === herramientas.length - 1 ? { ...h, cache_control: { type: 'ephemeral' } } : h));
    const respuesta = await this._crear({
      model: modelo, max_tokens: maxTokens, temperature: temperatura, system: this._sistema(sistema), messages: mensajes, tools,
      tool_choice: eleccion === 'any' ? { type: 'any' } : { type: 'tool', name: eleccion.nombre },
    }, timeoutMs);
    const u = respuesta.usage || {};
    return {
      contenido: respuesta.content || [], modelo: respuesta.model || modelo, stopReason: respuesta.stop_reason,
      uso: { entrada: u.input_tokens || 0, salida: u.output_tokens || 0, cacheLectura: u.cache_read_input_tokens || 0, cacheEscritura: u.cache_creation_input_tokens || 0 },
    };
  }

  async generar({ modelo, sistema = [], mensajes, herramienta, maxTokens = 2000, temperatura = 0.2, timeoutMs = 60000 }) {
    const respuesta = await this._crear({
      model: modelo, max_tokens: maxTokens, temperature: temperatura, system: this._sistema(sistema), messages: mensajes,
      tools: [herramienta], tool_choice: { type: 'tool', name: herramienta.name },
    }, timeoutMs);
    const bloque = (respuesta.content || []).find((c) => c.type === 'tool_use' && c.name === herramienta.name);
    const u = respuesta.usage || {};
    return {
      toolInput: bloque ? bloque.input : null,
      toolUseId: bloque ? bloque.id : null,
      modelo: respuesta.model || modelo,
      stopReason: respuesta.stop_reason,
      uso: { entrada: u.input_tokens || 0, salida: u.output_tokens || 0, cacheLectura: u.cache_read_input_tokens || 0, cacheEscritura: u.cache_creation_input_tokens || 0 },
    };
  }
}

module.exports = new AnthropicAdapter();
module.exports.AnthropicAdapter = AnthropicAdapter;
