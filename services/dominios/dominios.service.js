/*
    Author: German Valencia
    Pattern: PLATAFORMA Service - Dominios de la plataforma (OT-012, migración 026)
    Description:
      contexto({ host }, origen)        contexto del dominio para la web (público). Desconocido → neutro, nunca la consola
      contextoDeOrigen(origin, referer) igual, desde los encabezados de la petición (lo usa el middleware validarDominio)
      usuarioPuedeEntrar(ctx, cod)      consola/neutro: sí; aplicación: solo si su suscriptor se la asigna (CC-145)
      origenPermitido(origin)           ¿el origen es https://<un dominio activo>? (CORS); síncrono, sobre la caché
      refrescar()                       recarga la caché de dominios (al arrancar y cada 5 minutos)
    Cachés: dominios 5 minutos; aplicaciones de cada usuario 5 minutos. Si la base falla, se conserva la última lista buena.
*/
const Repo = require('../../repositories/dominios/dominios.repository');
const { validarCon } = require('../../helpers/errores.helper');
const { ContextoQuerySchema } = require('../../models/dominios/dominios.model');
const D = require('../../utils/dominios/dominios');

const CACHE_MS = 5 * 60 * 1000;

class DominiosService {
  constructor({ repo = Repo, cacheMs = CACHE_MS, ahora = () => Date.now() } = {}) {
    this.repo = repo;
    this.cacheMs = cacheMs;
    this.ahora = ahora;
    this.indice = new Map();
    this.cargadoEn = 0;
    this.cargando = null;
    this.appsPorUsuario = new Map();
  }

  async refrescar() {
    if (this.cargando) return this.cargando;
    this.cargando = (async () => {
      try {
        this.indice = D.indexar(await this.repo.dominios());
      } catch (error) {
        console.warn('⚠️ [Dominios] No se pudo leer PTL_DominiosAP; se conserva la lista anterior:', error?.message || error);
      } finally {
        this.cargadoEn = this.ahora();
        this.cargando = null;
      }
      return this.indice;
    })();
    return this.cargando;
  }

  async indiceVigente() {
    if (!this.cargadoEn || this.ahora() - this.cargadoEn > this.cacheMs) await this.refrescar();
    return this.indice;
  }

  async contexto(query = {}, origen = {}) {
    const { host } = validarCon(ContextoQuerySchema, query || {});
    const indice = await this.indiceVigente();
    return D.contextoDe(D.normalizarHost(host) || D.hostDeOrigen(origen.origin, origen.referer), indice);
  }

  async contextoDeOrigen(origin, referer) {
    const host = D.hostDeOrigen(origin, referer);
    if (!host) return D.contextoDe('', null);
    return D.contextoDe(host, await this.indiceVigente());
  }

  async aplicacionesDeUsuario(codigoUsuario) {
    const guardado = this.appsPorUsuario.get(codigoUsuario);
    if (guardado && this.ahora() - guardado.en <= this.cacheMs) return guardado.apps;
    const apps = await this.repo.aplicacionesDeUsuario(codigoUsuario);
    this.appsPorUsuario.set(codigoUsuario, { apps, en: this.ahora() });
    if (this.appsPorUsuario.size > 5000) this.appsPorUsuario.clear();
    return apps;
  }

  async usuarioPuedeEntrar(contexto, codigoUsuario) {
    if (!contexto || contexto.tipo !== 'aplicacion') return true;
    if (!codigoUsuario) return false;
    return D.puedeEntrar(contexto, await this.aplicacionesDeUsuario(codigoUsuario));
  }

  origenPermitido(origin) {
    const host = D.normalizarHost(origin);
    return !!host && /^https:\/\//i.test(String(origin || '').trim()) && this.indice.has(host);
  }
}

const instancia = new DominiosService();
module.exports = instancia;
module.exports.DominiosService = DominiosService;
