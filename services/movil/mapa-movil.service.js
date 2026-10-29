/*
    Author: German Valencia
    Pattern: PORTTOS Service - Mapa logístico de la app móvil (fase 4)
    Description: Un solo endpoint liviano con las capas del mapa de la web para el puerto elegido:
        mapa({ puerto }) → utils/movil/mapa-movil.armarMapa(...)
      Reutiliza MapaGeneralService.getCapaNaves (AIS + perfil DIMAR), FlotaTerrestre.obtenerFlotaGeoJSON y los eventos
      viales vigentes del corredor (misma caja que el mapa de la web). Cada capa con tiempo límite: si una falla, el
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
    naves = (clave) => MapaGeneralService.porDefecto().getCapaNaves(clave).then((r) => r.data),
    flota = (clave) => FlotaTerrestre.obtenerFlotaGeoJSON(clave),
    eventos = (cajaT, ahora) => (cajaT ? EventosViales.activos(cajaT, { ahora }) : []),
    cacheMs = CACHE_MS,
  } = {}) {
    Object.assign(this, { puertos, caja, capas: { naves, flota, eventos }, cacheMs });
    this.cache = new Map();
  }

  async mapa(params, ahora = new Date()) {
    const { puerto } = validarCon(PuertoParamsSchema, params);
    const p = await this.puertos.resolver(puerto);                 // 404 si no existe
    const guardado = this.cache.get(p.clave);
    if (guardado && ahora.getTime() - guardado.en < this.cacheMs) return guardado.valor;

    const [cajaMaritima, cajaTerrestre] = await Promise.all([this.caja(p.clave, MARGEN.MARITIMO), this.caja(p.clave, MARGEN.TERRESTRE)]);
    const nombres = ['naves', 'flota', 'eventos'];
    const r = await Promise.allSettled([
      conTiempo(Promise.resolve().then(() => this.capas.naves(p.clave)), TIEMPO_CAPA_MS, 'naves'),
      conTiempo(Promise.resolve().then(() => this.capas.flota(p.clave)), TIEMPO_CAPA_MS, 'flota'),
      conTiempo(Promise.resolve().then(() => this.capas.eventos(cajaTerrestre, ahora)), TIEMPO_CAPA_MS, 'eventos'),
    ]);
    const valor = (i) => (r[i].status === 'fulfilled' ? r[i].value : null);
    const fallidas = nombres.filter((_, i) => r[i].status !== 'fulfilled');
    const mapa = { ...armarMapa({ puerto: p.clave, cajaMaritima, cajaTerrestre, naves: valor(0), flota: valor(1), eventos: valor(2), ahora }), nombrePuerto: p.nombre, fallidas };
    this.cache.set(p.clave, { en: ahora.getTime(), valor: mapa });
    return mapa;
  }
}

module.exports = new MapaMovilService();
module.exports.MapaMovilService = MapaMovilService;
