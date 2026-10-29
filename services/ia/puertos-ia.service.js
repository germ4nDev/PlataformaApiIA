/*
    Author: German Valencia
    Pattern: PORTTOS Service - Puertos de la capa de IA
    Description: La capa de IA trabaja con cualquier puerto del maestro (TCL_MaestroPuertos), no con uno fijo.
      - resolver(entrada): id o nombre ('BUN', 'Buenaventura', 'santa marta') → { clave, idPuerto, nombre }, con una
        clave canónica (el nombre normalizado) para que las fotos y los hallazgos de un puerto no se partan en dos.
        Si el puerto no existe → 404.
      - activos(): los puertos que analiza la capa. IA_PUERTOS=TODOS (por defecto) = todos los puertos del maestro
        que tienen geocerca configurada (la caja que usan el radar AIS, el mapa y los corredores viales);
        o una lista separada por comas. Caché de 10 min.
      - habilitado(clave): si un puerto está entre los activos (para analizar a demanda).
*/
const { configIA } = require('../../config/ia.config');
const { contextoPuerto } = require('../../helpers/puerto-contexto.helper');
const { listarPuertos } = require('../../helpers/caja-puerto.helper');
const { normalizarPuerto } = require('../../helpers/salas.helper');

const CACHE_MS = 10 * 60000;

class PuertosIAService {
  constructor({ config = configIA, contexto = contextoPuerto, listar = listarPuertos } = {}) {
    Object.assign(this, { config, contexto, listar });
    this.cache = { hasta: 0, lista: [] };
  }

  get todos() {
    return this.config.puertos.includes('TODOS');
  }

  async resolver(entrada) {
    const p = await this.contexto(entrada);   // 404 si no existe
    return { clave: normalizarPuerto(p.nombre || p.clave), idPuerto: p.idPuerto, nombre: p.nombre || p.clave };
  }

  async activos(ahoraMs = Date.now()) {
    if (ahoraMs < this.cache.hasta) return this.cache.lista;
    const entradas = this.todos ? (await this.listar()).map((p) => p.clave) : this.config.puertos;
    const vistos = new Map();
    for (const entrada of entradas) {
      try {
        const p = await this.resolver(entrada);
        if (!vistos.has(p.clave)) vistos.set(p.clave, p);
      } catch (error) {
        console.warn(`[IA] Puerto ${entrada} de IA_PUERTOS no existe en el maestro: se omite.`);
      }
    }
    this.cache = { hasta: ahoraMs + CACHE_MS, lista: [...vistos.values()] };
    return this.cache.lista;
  }

  async habilitado(clave) {
    return (await this.activos()).some((p) => p.clave === clave);
  }
}

module.exports = new PuertosIAService();
module.exports.PuertosIAService = PuertosIAService;
