/*
    Author: German Valencia
    Pattern: PORTTOS Core puro (AD-16) - Control de las llamadas al modelo: costo, presupuesto, cortacircuito, reintentos
    Description:
      - costoUsd(modelo, uso): costo estimado de una llamada con la tabla de precios de Anthropic.
        Fuente: platform.claude.com/docs/en/about-claude/pricing (consultado el 2026-10-24). Si cambian los precios
        se actualiza PRECIOS_USD_MTOK; un modelo sin precio devuelve null (se registra la llamada sin costo).
      - evaluarPresupuesto(uso, topes): si se puede llamar hoy y qué tanto del tope va.
      - Cortacircuito: 3 fallos seguidos lo abren 15 min; mientras esté abierto no se llama al modelo.
      - esReintentable(error) y esperaReintento(intento): 429, 5xx, 529 y tiempo agotado; espera de 2 s y 4 s.
*/

/** USD por millón de tokens. cacheEscritura = escritura de caché de 5 min; cacheLectura = acierto de caché. */
const PRECIOS_USD_MTOK = Object.freeze({
  'claude-sonnet-5-5': { entrada: 2, salida: 10, cacheEscritura: 2.5, cacheLectura: 0.10 },
  // Haiku 5.5 cobra según el largo del prompt (entrada total, con caché): hasta 100.000 tokens o más
  'claude-haiku-5-5': {
    entrada: 0.10, salida: 0.50, cacheEscritura: 0.125, cacheLectura: 0.01,
    largo: { desde: 100000, entrada: 0.50, salida: 2.50, cacheEscritura: 0.625, cacheLectura: 0.05 },
  },
});

/**
 * @param {string} modelo
 * @param {{entrada:number, salida:number, cacheLectura?:number, cacheEscritura?:number}} uso  tokens
 * @returns {number|null}  USD con 5 decimales, o null si el modelo no tiene precio
 */
function costoUsd(modelo, uso = {}) {
  const base = PRECIOS_USD_MTOK[String(modelo || '').replace(/-\d{8}$/, '')];
  if (!base) return null;
  const n = (v) => Math.max(0, Number(v) || 0);
  const totalEntrada = n(uso.entrada) + n(uso.cacheLectura) + n(uso.cacheEscritura);
  const p = base.largo && totalEntrada > base.largo.desde ? base.largo : base;
  const usd = (n(uso.entrada) * p.entrada + n(uso.salida) * p.salida + n(uso.cacheEscritura) * p.cacheEscritura + n(uso.cacheLectura) * p.cacheLectura) / 1e6;
  return Math.round(usd * 1e5) / 1e5;
}

/**
 * @param {{llamadas:number, tokens:number}} usoHoy
 * @param {{llamadas:number, tokens:number}} topes
 */
function evaluarPresupuesto(usoHoy = {}, topes = {}) {
  const llamadas = Number(usoHoy.llamadas) || 0;
  const tokens = Number(usoHoy.tokens) || 0;
  const pct = Math.max(topes.llamadas ? llamadas / topes.llamadas : 0, topes.tokens ? tokens / topes.tokens : 0);
  if (topes.llamadas && llamadas >= topes.llamadas) return { permitido: false, motivo: `tope de ${topes.llamadas} llamadas del día`, pct };
  if (topes.tokens && tokens >= topes.tokens) return { permitido: false, motivo: `tope de ${topes.tokens} tokens del día`, pct };
  return { permitido: true, motivo: null, pct, aviso: pct >= 0.8 };
}

class Cortacircuito {
  constructor({ fallosParaAbrir = 3, abiertoMs = 15 * 60000 } = {}) {
    Object.assign(this, { fallosParaAbrir, abiertoMs, fallos: 0, abiertoHasta: 0 });
  }
  abierto(ahoraMs = Date.now()) { return ahoraMs < this.abiertoHasta; }
  exito() { this.fallos = 0; this.abiertoHasta = 0; }
  fallo(ahoraMs = Date.now()) {
    this.fallos += 1;
    if (this.fallos >= this.fallosParaAbrir) this.abiertoHasta = ahoraMs + this.abiertoMs;
  }
  estado(ahoraMs = Date.now()) {
    return { abierto: this.abierto(ahoraMs), fallosSeguidos: this.fallos, hasta: this.abierto(ahoraMs) ? new Date(this.abiertoHasta).toISOString() : null };
  }
}

const esReintentable = (error) => {
  const s = Number(error?.status);
  return error?.reintentable === true || s === 429 || s === 529 || (s >= 500 && s < 600) || /timeout|timed out|ECONNRESET|ETIMEDOUT/i.test(error?.message || '');
};
const esperaReintento = (intento) => 2000 * 2 ** Math.max(0, intento - 1);   // 2 s, 4 s

module.exports = { PRECIOS_USD_MTOK, costoUsd, evaluarPresupuesto, Cortacircuito, esReintentable, esperaReintento };
