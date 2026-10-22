/*
    Author: German Valencia
    Pattern: PORTTOS Service - Simulador de la flota terrestre (proceso 'simulador-flota', cada 10 s fuera de producción)
    Description: Orquesta el núcleo puro utils/simulador-flota.js:
      - rutas: waypoints de TCL_SimuladorWaypoints (caché 30 min), con sus peajes (helpers/peajes.helper) y los
        extremos que caen en un puerto (helpers/caja-puerto.helper → puertosEnPunto);
      - camiones: TCL_FlotaTerrestre con id_ruta (se relee cada 5 min para tomar altas y bajas);
      - eventos viales activos (cada 2 min): frenan o detienen a los camiones que los tienen adelante;
      - escribe solo los camiones que cambiaron y, cada 30 s, corre las alertas del mapa sobre la flota.
    El estado vive en memoria: al reiniciar el API cada camión arranca desde su paso_actual.
*/
const FlotaTerrestreRepository = require('../../repositories/torre-control/flota-terrestre.repository');
const EventosVialesRepository = require('../../repositories/torre-control/eventos-viales.repository');
const AlertasMapaService = require('./alertas-mapa.service');
const { puertosEnPunto } = require('../../helpers/caja-puerto.helper');
const { peajesNacionales } = require('../../helpers/peajes.helper');
const S = require('../../utils/simulador-flota');
const V = require('../../utils/ruteo-vial');

const RUTAS_TTL_MS = 30 * 60 * 1000;
const FLOTA_TTL_MS = 5 * 60 * 1000;
const EVENTOS_TTL_MS = 2 * 60 * 1000;
const ALERTAS_CADA_MS = 30 * 1000;
const MARGEN_PUERTO_GRADOS = 0.05;   // ~5 km: el extremo de la ruta está en la zona del puerto

class SimuladorFlotaService {
  constructor({ repositorio = FlotaTerrestreRepository, eventos = EventosVialesRepository, alertas = AlertasMapaService,
    peajes = peajesNacionales, puertoEn = puertosEnPunto, rng = Math.random } = {}) {
    Object.assign(this, { repositorio, eventosRepo: eventos, alertas, peajes, puertoEn, rng });
    this.rutas = new Map();
    this.camiones = new Map();
    this.escrito = new Map();     // placa → última fila escrita (para escribir solo lo que cambia)
    this.hasta = { rutas: 0, flota: 0, eventos: 0, alertas: 0 };
    this.ultimoMs = 0;
  }

  async _cargarRutas(ahoraMs) {
    if (ahoraMs < this.hasta.rutas && this.rutas.size) return;
    const crudas = await this.repositorio.rutasSimulador();
    const puertos = new Map();
    for (const r of crudas) {
      for (const p of [r.puntos[0], r.puntos[r.puntos.length - 1]]) {
        if (!p) continue;
        const [clave] = await this.puertoEn(p.lon, p.lat, MARGEN_PUERTO_GRADOS);
        puertos.set(`${p.lon},${p.lat}`, clave || null);
      }
    }
    const peajes = this.peajes();
    const rutas = new Map();
    for (const r of crudas) {
      const ruta = S.prepararRuta(r, { peajes, puertoEn: (lon, lat) => puertos.get(`${lon},${lat}`) ?? null });
      if (ruta) {
        ruta.eventos = this.rutas.get(ruta.id)?.eventos || [];
        rutas.set(ruta.id, ruta);
      }
    }
    this.rutas = rutas;
    this.hasta.rutas = ahoraMs + RUTAS_TTL_MS;
  }

  async _cargarFlota(ahoraMs) {
    if (ahoraMs < this.hasta.flota && this.camiones.size) return;
    const filas = await this.repositorio.flotaSimulada();
    const vigentes = new Set();
    for (const f of filas) {
      const ruta = this.rutas.get(f.id_ruta);
      if (!ruta) continue;
      vigentes.add(f.placa);
      const actual = this.camiones.get(f.placa);
      if (!actual || actual.ruta !== ruta.id) {
        this.camiones.set(f.placa, S.crearCamion(f.placa, ruta, Number(f.paso_actual), ahoraMs, this.rng));
      }
    }
    for (const placa of this.camiones.keys()) if (!vigentes.has(placa)) { this.camiones.delete(placa); this.escrito.delete(placa); }
    this.hasta.flota = ahoraMs + FLOTA_TTL_MS;
  }

  async _cargarEventos(ahoraMs) {
    if (ahoraMs < this.hasta.eventos) return;
    this.hasta.eventos = ahoraMs + EVENTOS_TTL_MS;
    const eventos = await this.eventosRepo.activos(null).catch(() => null);
    if (!eventos) return;   // sin eventos nuevos se quedan los anteriores
    for (const ruta of this.rutas.values()) ruta.eventos = S.eventosSobreRuta(ruta, eventos);
  }

  /** Un ciclo: avanza la flota el tiempo transcurrido y escribe lo que cambió. Devuelve cuántos camiones escribió. */
  async ciclo(ahora = new Date()) {
    const ahoraMs = ahora.getTime();
    await this._cargarRutas(ahoraMs);
    if (!this.rutas.size) return 0;
    await this._cargarFlota(ahoraMs);
    await this._cargarEventos(ahoraMs);

    const dt = this.ultimoMs ? (ahoraMs - this.ultimoMs) / 1000 : 0;
    this.ultimoMs = ahoraMs;
    for (const c of this.camiones.values()) S.avanzar(this.rutas.get(c.ruta), c, dt, ahoraMs, this.rng);

    const cambios = S.posiciones(this.rutas, [...this.camiones.values()]).filter((f) => {
      const k = `${f.lon},${f.lat},${f.estado},${f.velocidad},${f.rumbo}`;
      if (this.escrito.get(f.placa) === k) return false;
      this.escrito.set(f.placa, k);
      return true;
    });
    if (cambios.length) {
      try {
        await this.repositorio.actualizarSimulacion(cambios);
      } catch (error) {
        cambios.forEach((f) => this.escrito.delete(f.placa));   // la próxima vuelta lo intenta de nuevo
        throw error;
      }
    }

    if (ahoraMs >= this.hasta.alertas) {
      this.hasta.alertas = ahoraMs + ALERTAS_CADA_MS;
      await this.alertas.evaluarFlota(ahora).catch((e) => console.error('[AlertasMapa] evaluarFlota:', e.message));
    }
    return cambios.length;
  }

  /**
   * Ajusta las rutas del simulador a la vía (scripts/rutas-simulador.js).
   *   fuente 'osrm' (por defecto): ruteo sobre OpenStreetMap, la misma cartografía del fondo del mapa; puntos de
   *     paso cada ~10 km de la ruta actual y limpieza de espuelas. Si OSRM no responde, usa la red vial.
   *   fuente 'red': grafo de la red vial INVIAS/IGAC ('tramos', que el script lee del archivo). Sin conexión a internet.
   * Sin 'escribir' solo calcula (vista previa); con 'escribir' reemplaza los waypoints.
   */
  async ajustarRutasALaVia(tramos, { escribir = false, ids = null, fuente = 'osrm', rutaOsrm = null } = {}) {
    const rutear = rutaOsrm || require('../../adapters/osrm.adapter').rutaPorPuntos;
    const rutas = (await this.repositorio.rutasSimulador()).filter((r) => !ids || ids.includes(Number(r.id)));
    const informe = [];
    for (const r of rutas) {
      const original = [...r.puntos].sort((a, b) => a.paso - b.paso).map((p) => [p.lon, p.lat]);
      let ajuste = null, usada = fuente, aviso = null;
      if (fuente === 'osrm') {
        try {
          const vias = V.puntosDePaso(original);
          const { coords } = await rutear(vias);
          const limpias = V.quitarEspuelas(coords);
          ajuste = { coords: limpias, ajustados: vias.length - 1, sinAjuste: [], largoOriginal: V.largoDe(original), largoNuevo: V.largoDe(limpias) };
        } catch (error) {
          aviso = `${error.message}; se usó la red vial`;
          usada = 'red';
        }
      }
      if (!ajuste) {
        if (!tramos?.length) throw new Error('No hay red vial para ajustar sin OSRM');
        ajuste = V.ajustarRuta(V.construirGrafo(tramos, V.cajaDe(original, 0.1)), original);
      }
      const rumbos = V.rumbos(ajuste.coords);
      const fila = {
        id: r.id, fuente: usada, aviso, puntosAntes: original.length, puntosDespues: ajuste.coords.length,
        kmAntes: Math.round(ajuste.largoOriginal / 100) / 10, kmDespues: Math.round(ajuste.largoNuevo / 100) / 10,
        ajustados: ajuste.ajustados, sinAjuste: ajuste.sinAjuste, original, ajustada: ajuste.coords,
      };
      if (escribir && ajuste.ajustados > 0) {
        fila.escrito = await this.repositorio.reemplazarRutaSimulador(r.id,
          ajuste.coords.map((c, i) => ({ lon: Math.round(c[0] * 1e7) / 1e7, lat: Math.round(c[1] * 1e7) / 1e7, rumbo: rumbos[i] })));
      }
      informe.push(fila);
    }
    if (escribir) { this.hasta.rutas = 0; this.camiones.clear(); this.escrito.clear(); this.ultimoMs = 0; }
    return informe;
  }

  /** Resumen para el disparador manual (GET /api/flota-terrestre/simular-tick). */
  resumen() {
    const porEstado = {};
    for (const f of S.posiciones(this.rutas, [...this.camiones.values()])) porEstado[f.estado] = (porEstado[f.estado] || 0) + 1;
    return {
      rutas: [...this.rutas.values()].map((r) => ({
        id: r.id, km: Math.round(r.largo / 100) / 10, peajes: r.peajes.map((p) => p.nombre),
        puertoInicio: r.puertoInicio, puertoFin: r.puertoFin, eventos: r.eventos.length,
      })),
      camiones: this.camiones.size,
      porEstado,
    };
  }
}

module.exports = new SimuladorFlotaService();
module.exports.SimuladorFlotaService = SimuladorFlotaService;
