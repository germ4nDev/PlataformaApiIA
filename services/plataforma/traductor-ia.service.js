/*
    Author: German Valencia
    Pattern: PLATAFORMA Service - Traductor de idiomas nuevos con IA (CC-215, usuario 2026-11-16)
    Description: Traduce del español un lote de llaves con el adaptador de IA (adapters/ia, salida forzada). No escribe archivos:
      eso es de traducciones.service. Un texto que vuelve mal (sin llave, vacío o sin sus {{parámetros}}) se pide otra vez una sola
      vez; si sigue mal queda en español y se informa.
      disponible()                         { ok, motivo }: hace falta IA_PROVEEDOR=anthropic (o sin valor) y ANTHROPIC_API_KEY
      traducirLote({ sigla, nombre, lote }) → { buenas: { llave: texto }, malas: [llaves], uso: { entrada, salida } }
    Modelo: IA_MODELO_TRADUCTOR (por defecto claude-sonnet-5-5). La llave nunca se lee aquí: la usa el adaptador.
*/
const T = require('../../utils/plataforma/traduccion-ia');
// los reintentos son propios: utils/ia es de Porttos (regla 26); el adaptador marca reintentable (429, 529, 5xx, tiempo)
const esReintentable = (e) => e?.reintentable === true;
const esperaReintento = (intento) => 2000 * 2 ** Math.max(0, intento - 1);

const MODELO = () => String(process.env.IA_MODELO_TRADUCTOR || '').trim() || 'claude-sonnet-5-5';
const REINTENTOS = 2;

class TraductorIAService {
  constructor({ adaptador = null, env = process.env, dormir } = {}) {
    this._adaptador = adaptador;
    this.env = env;
    this.dormir = dormir || ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  get adaptador() {
    return this._adaptador || (this._adaptador = require('../../adapters/anthropic.adapter'));
  }

  disponible() {
    const proveedor = String(this.env.IA_PROVEEDOR || 'anthropic').trim().toLowerCase();
    if (proveedor !== 'anthropic') return { ok: false, motivo: 'IA_PROVEEDOR no es anthropic: no hay traductor.' };
    if (!this._adaptador && !this.env.ANTHROPIC_API_KEY) return { ok: false, motivo: 'Falta ANTHROPIC_API_KEY en el .env del API.' };
    return { ok: true };
  }

  async _llamar(sigla, nombre, lote) {
    const { sistema, mensajes, herramienta } = T.solicitudLote({ sigla, nombre, lote });
    for (let intento = 1; ; intento++) {
      try {
        const r = await this.adaptador.generar({ modelo: MODELO(), sistema, mensajes, herramienta, maxTokens: 8000, temperatura: 0.2, timeoutMs: 120000 });
        return { lista: r.toolInput?.traducciones || [], uso: r.uso || {} };
      } catch (e) {
        if (intento > REINTENTOS || !esReintentable(e)) throw e;
        await this.dormir(esperaReintento(intento));
      }
    }
  }

  async traducirLote({ sigla, nombre, lote }) {
    const uso = { entrada: 0, salida: 0 };
    const sumar = (u) => { uso.entrada += u.entrada || 0; uso.salida += u.salida || 0; };
    const a = await this._llamar(sigla, nombre, lote);
    sumar(a.uso);
    let { buenas, malas } = T.revisarLote(lote, a.lista);
    if (malas.length) {
      const resto = lote.filter(([llave]) => malas.includes(llave));
      const b = await this._llamar(sigla, nombre, resto);
      sumar(b.uso);
      const r2 = T.revisarLote(resto, b.lista);
      buenas = { ...buenas, ...r2.buenas };
      malas = r2.malas;
    }
    return { buenas, malas, uso };
  }
}

module.exports = new TraductorIAService();
module.exports.TraductorIAService = TraductorIAService;
