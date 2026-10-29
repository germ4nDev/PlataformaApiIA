/*
    Author: German Valencia
    Pattern: PORTTOS Service - Configuración efectiva de la capa de IA por puerto y tarea (fase 4)
    Description: Lee TCL_IAConfig (caché de 60 s) y la mezcla con el .env (utils/ia/config-efectiva.resolverConfig).
      Antes de la migración 017 (sin la columna tiposPublicar) ignora la tabla: la fila semilla de la 015 viene
      apagada y no debe apagar al analista que el .env encendió. Sin la 015, solo el .env.
      - efectiva(puerto, tarea)  → { habilitada, activa, modoSombra, topes, confianzaMinima, tiposPublicar, origen }
      - filas()                  → las filas vigentes (para el panel)   · invalidar() tras guardar desde el panel
*/
const { configIA } = require('../../config/ia.config');
const AdminRepo = require('../../repositories/ia/admin-ia.repository');
const { resolverConfig } = require('../../utils/ia/config-efectiva');

const TTL_MS = 60 * 1000;

class ConfigIAService {
  constructor({ config = configIA, repo = AdminRepo } = {}) {
    Object.assign(this, { config, repo });
    this.cache = { hasta: 0, filas: [], esquema017: false };
  }

  async _cargar(ahoraMs = Date.now()) {
    if (ahoraMs < this.cache.hasta) return this.cache;
    let filas = [];
    let esquema017 = false;
    try {
      const todas = await this.repo.configuraciones();
      esquema017 = todas.length === 0 || Object.prototype.hasOwnProperty.call(todas[0], 'tiposPublicar');
      filas = esquema017 ? todas : [];
    } catch (error) {
      if (error?.codigo !== 'MIGRACION_PENDIENTE') console.error('[IA] No se pudo leer TCL_IAConfig:', error?.msg || error?.message);
    }
    this.cache = { hasta: ahoraMs + TTL_MS, filas, esquema017 };
    return this.cache;
  }

  async efectiva(puerto, tarea, ahoraMs = Date.now()) {
    const { filas } = await this._cargar(ahoraMs);
    return resolverConfig(filas, puerto, tarea, this.config);
  }

  async filas(ahoraMs = Date.now()) {
    return this._cargar(ahoraMs);
  }

  invalidar() {
    this.cache.hasta = 0;
  }
}

module.exports = new ConfigIAService();
module.exports.ConfigIAService = ConfigIAService;
