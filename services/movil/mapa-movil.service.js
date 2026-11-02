/*
    Author: German Valencia
    Pattern: PORTTOS Service - Mapa logístico de la app móvil (fase 4)
    Description: Un solo endpoint liviano con las capas del mapa de la web para el puerto elegido:
        mapa({ puerto }) → utils/movil/mapa-movil.armarMapa(...)
      Reutiliza MapaGeneralService.getCapaNaves (AIS + perfil DIMAR), FlotaTerrestre.obtenerFlotaGeoJSON y obtenerCapaGeocercas, y los eventos
      viales vigentes del corredor (misma caja que el mapa de la web). Con las naves viaja `senalAis` (utils/senal-ais.js). Cada capa con tiempo límite: si una falla, el
      mapa sale sin ella (`fallidas`). Caché de 15 s por puerto (los teléfonos consultan cada 20 s).
*/
const PuertosIA = require('../ia/puertos-ia.service');
const MapaGeneralService = require('../torre-control/mapa-general.service');
const FlotaTerrestre = require('../torre-control/flota-terrestre.service');
const EventosViales = require('../../repositories/torre-control/eventos-viales.repository');
const { cajaPuerto, MARGEN } = require('../../helpers/caja-puerto.helper');
const { validarCon } = require('../../helpers/errores.helper');
const { PuertoParamsSchema } = require('../../models/ia/analisis-ia.model');
const { armarMapa } = require('../../utils/movil/mapa-movil');
const { geocercasMovil } = require('../../utils/geocercas-mapa');

const CACHE_MS = 15000;
const TIEMPO_CAPA_MS = 15000;

const conTiempo = (promesa, ms, nombre) => Promise.race([
  promesa,
  new Promise((_, rechazar) => setTimeout(() => rechazar(new Error(`${nombre}: sin respuesta en ${ms / 1000} s`)), ms)),
]);

class MapaMovilService {
  constructor({
    puertos = PuertosIA,
    caja = cajaPuerto,
    // Devuelve { data, senal } (señal AIS, 2026-10-29); una FeatureCollection sola también sirve (senal null)
    naves = (clave) => MapaGeneralService.porDefecto().getCapaNaves(clave),
    flota = (clave) => FlotaTerrestre.obtenerFlotaGeoJSON(clave),
    eventos = (cajaT, ahora) => (cajaT ? EventosViales.activos(cajaT, { ahora }) : []),
    // Geocercas de los faros del puerto con sus KPI, las mismas del «Radar de geocercas» de la web (OT-007)
    geocercas = (clave) => FlotaTerrestre.obtenerCapaGeocercas(clave),
    cacheMs = CACHE_MS,
  } = {}) {
    Object.assign(this, { puertos, caja, capas: { naves, flota, eventos, geocercas }, cacheMs });
    this.cache = new Map();
  }

  async mapa(params, ahora = new Date()) {
    const { puerto } = validarCon(PuertoParamsSchema, params);
    const p = await this.puertos.resolver(puerto);                 // 404 si no existe
    const guardado = this.cache.get(p.clave);
    if (guardado && ahora.getTime() - guardado.en < this.cacheMs) return guardado.valor;

    const [cajaMaritima, cajaTerrestre] = await Promise.all([this.caja(p.clave, MARGEN.MARITIMO), this.caja(p.clave, MARGEN.TERRESTRE)]);
    const nombres = ['naves', 'flota', 'eventos', 'geocercas'];
    const r = await Promise.allSettled([
      conTiempo(Promise.resolve().then(() => this.capas.naves(p.clave)), TIEMPO_CAPA_MS, 'naves'),
      conTiempo(Promise.resolve().then(() => this.capas.flota(p.clave)), TIEMPO_CAPA_MS, 'flota'),
      conTiempo(Promise.resolve().then(() => this.capas.eventos(cajaTerrestre, ahora)), TIEMPO_CAPA_MS, 'eventos'),
      conTiempo(Promise.resolve().then(() => this.capas.geocercas(p.clave)), TIEMPO_CAPA_MS, 'geocercas'),
    ]);
    const valor = (i) => (r[i].status === 'fulfilled' ? r[i].value : null);
    const fallidas = nombres.filter((_, i) => r[i].status !== 'fulfilled');
    const capaNaves = valor(0);
    const naves = capaNaves?.features ? capaNaves : capaNaves?.data ?? null;
    const senalAis = capaNaves?.features ? null : capaNaves?.senal ?? null;
    const mapa = { ...armarMapa({ puerto: p.clave, cajaMaritima, cajaTerrestre, naves, flota: valor(1), eventos: valor(2), geocercas: geocercasMovil(valor(3)), senalAis, ahora }), nombrePuerto: p.nombre, fallidas };
    this.cache.set(p.clave, { en: ahora.getTime(), valor: mapa });
    return mapa;
  }
}

module.exports = new MapaMovilService();
module.exports.MapaMovilService = MapaMovilService;
