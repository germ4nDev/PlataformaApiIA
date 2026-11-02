/*
    Author: German Valencia
    Pattern: PORTTOS Service - Portal público porttos.co (migración 025, 2026-10-30)
    Description:
      config()                       claves públicas de TCL_PortalConfig (correo de contacto, ruta del login de la plataforma, avisos)
      pagina({ pagina, idioma })     secciones y elementos de la página, con las cifras reales del maestro
      planes()                       planes, características y comparativo (aviso de valores de referencia si son simulados)
      preguntas({ pagina, idioma })  preguntas frecuentes
      mensaje(body, origen)          Contáctenos: valida, frena abusos (5 por hora por origen), descarta spam en silencio,
                                     guarda en TCL_PortalMensajes y avisa por correo al correoContacto (si el SMTP está
                                     configurado; si no, queda notificado = 0 para el equipo)
      puertos()                      puertos activos del maestro para el selector de «Puertos en vivo»
      puertoEnVivo({ puerto })       solo datos públicos u oficiales, nunca simulados (OT-011): vías de acceso (eventos
                                     de TomTom ya guardados por el cron, sin gastar cuota), tráfico mensual de Supertransporte,
                                     clima (Open-Meteo) y próxima pleamar (WorldTides); cada uno con su fuente y hora
    Planes de comercialización (CC-106): con TCL_PortalConfig.planesActivos distinto de '1' (o sin la clave) la página «planes»
    responde 404, planes() sale vacío, las demás páginas pierden sus enlaces a /planes y un mensaje no guarda plan.
    Lecturas en caché 5 minutos (el contenido cambia poco y el portal es público).
*/
const Repo = require('../../repositories/portal/portal.repository');
const EventosViales = require('../../repositories/torre-control/eventos-viales.repository');
const Correo = require('../../adapters/correo.adapter');
const OpenMeteo = require('../../adapters/open-meteo.adapter');
const FuentesExternas = require('../../adapters/fuentes-externas.adapter');
const { validarCon } = require('../../helpers/errores.helper');
const { PaginaParamsSchema, IdiomaQuerySchema, MensajeBodySchema, PuertoParamsSchema } = require('../../models/portal/portal.model');
const P = require('../../utils/portal/portal');
const V = require('../../utils/portal/puertos-en-vivo');

const ANIOS_TRAFICO = 2;   // el año del último dato y el anterior (para la variación)
const fuentesVivo = {
  eventos: (caja) => EventosViales.activos(caja),
  clima: (lat, lon) => OpenMeteo.climaMarino(lat, lon),
  marea: (lat, lon) => FuentesExternas.getTideData(lat, lon),
};

const CACHE_MS = 5 * 60 * 1000;
const LIMITE_MENSAJES = 5;
const VENTANA_MS = 60 * 60 * 1000;

class PortalService {
  constructor({ repo = Repo, correo = Correo, vivo = fuentesVivo, cacheMs = CACHE_MS, ahora = () => Date.now() } = {}) {
    Object.assign(this, { repo, correo, vivo, cacheMs, ahora });
    this.cache = new Map();
    this.envios = new Map();
  }

  /** Guarda la promesa, no solo el valor: visitas simultáneas con la caché vacía comparten una sola consulta. Si falla, se borra. */
  enCache(llave, fn) {
    const g = this.cache.get(llave);
    if (g && this.ahora() - g.en < this.cacheMs) return g.promesa;
    const promesa = Promise.resolve().then(fn);
    this.cache.set(llave, { en: this.ahora(), promesa });
    promesa.catch(() => { if (this.cache.get(llave)?.promesa === promesa) this.cache.delete(llave); });
    return promesa;
  }

  config() {
    return this.enCache('config', async () => P.configPublica(await this.repo.config()));
  }

  async pagina(params, query = {}) {
    const { pagina } = validarCon(PaginaParamsSchema, params);
    const { idioma } = validarCon(IdiomaQuerySchema, query);
    const conPlanes = P.planesActivos(await this.config());
    if (pagina === 'planes' && !conPlanes) throw { statusCode: 404, msg: 'Esta página no está disponible por ahora.', codigo: 'PAGINA_INACTIVA' };
    const armada = await this.enCache(`pagina:${pagina}:${idioma}`, async () => {
      const secciones = await this.repo.secciones(pagina, idioma);
      const [elementos, cifras] = await Promise.all([
        this.repo.elementos(secciones.map((s) => s.id)),
        this.repo.cifras().catch(() => ({})),          // sin cifras, los elementos con {{…}} se omiten
      ]);
      return P.armarPagina({ pagina, secciones, elementos, cifras });
    });
    return conPlanes ? armada : P.sinPlanes(armada);
  }

  planes() {
    return this.enCache('planes', async () => {
      const config = await this.config();
      if (!P.planesActivos(config)) return P.PLANES_VACIOS;
      const [planes, caracteristicas, comparativo, valores] = await Promise.all([
        this.repo.planes(), this.repo.caracteristicas(), this.repo.comparativo(), this.repo.comparativoValores(),
      ]);
      return P.armarPlanes({ planes, caracteristicas, comparativo, valores, aviso: config.avisoPrecios });
    });
  }

  async preguntas(params, query = {}) {
    const { pagina } = validarCon(PaginaParamsSchema, params);
    const { idioma } = validarCon(IdiomaQuerySchema, query);
    return this.enCache(`preguntas:${pagina}:${idioma}`, async () =>
      (await this.repo.preguntas(pagina, idioma)).map((p) => ({ pregunta: p.pregunta, respuesta: p.respuesta })));
  }

  listaPuertos() {
    return this.enCache('puertos', async () => V.listaPuertos(await this.repo.puertosActivos()));
  }

  async puertos() {
    return (await this.listaPuertos()).map((p) => ({ id: p.id, nombre: p.nombre }));
  }

  async puertoEnVivo(params) {
    const { puerto: texto } = validarCon(PuertoParamsSchema, params);
    const puerto = V.buscarPuerto(await this.listaPuertos(), texto);
    if (!puerto) throw { statusCode: 404, msg: 'No encontramos ese puerto entre los puertos activos.', codigo: 'PUERTO_DESCONOCIDO' };
    return this.enCache(`vivo:${puerto.id}`, async () => {
      const ahora = new Date(this.ahora());
      const caja = V.cajaAccesos(puerto);
      const conPunto = puerto.lat !== null && puerto.lon !== null;
      // Cada fuente falla sola: lo que no responda sale «sin dato», el resto se muestra
      const zonas = V.zonasDelPuerto(puerto, FuentesExternas.ZONAS_TOMTOM || []);
      const [eventos, lecturasVias, filasTrafico, datosClima, datosMarea] = await Promise.all([
        caja ? this.vivo.eventos(caja).catch(() => null) : null,      // null = no se pudo saber (sin dato), no «cero eventos»
        this.repo.ultimaLecturaVias(zonas).catch(() => ({})),
        this.repo.traficoMensual(puerto.id, ahora.getUTCFullYear() - ANIOS_TRAFICO).catch(() => []),
        conPunto ? this.vivo.clima(puerto.lat, puerto.lon).catch(() => null) : null,
        conPunto ? this.vivo.marea(puerto.lat, puerto.lon).catch(() => null) : null,
      ]);
      const lecturaTrafico = filasTrafico.reduce((max, f) => (f.lectura && (!max || new Date(f.lectura) > new Date(max)) ? f.lectura : max), null);
      return V.armarPuertoEnVivo({ puerto, eventos, lecturasVias, filasTrafico, lecturaTrafico, datosClima, datosMarea }, ahora);
    });
  }

  /** Frena abusos: como mucho LIMITE_MENSAJES por origen en VENTANA_MS. */
  permitido(origen) {
    const t = this.ahora();
    const lista = (this.envios.get(origen) || []).filter((x) => t - x < VENTANA_MS);
    if (lista.length >= LIMITE_MENSAJES) { this.envios.set(origen, lista); return false; }
    lista.push(t);
    this.envios.set(origen, lista);
    return true;
  }

  async mensaje(body, origen = 'desconocido') {
    const v = validarCon(MensajeBodySchema, body);
    if (!this.permitido(origen)) {
      throw { statusCode: 429, msg: 'Recibimos varios mensajes desde este equipo. Intente de nuevo en una hora o escríbanos por correo.', codigo: 'DEMASIADOS' };
    }
    if (P.revisarMensaje(v).spam) return { recibido: true };   // en silencio: al robot no se le dice nada
    const conPlanes = P.planesActivos(await this.config().catch(() => ({})));
    const m = {
      motivo: v.motivo,
      codigoPlan: conPlanes ? P.limpiarTexto(v.codigoPlan, 40) : null,
      nombre: P.limpiarTexto(v.nombre, 120),
      empresa: P.limpiarTexto(v.empresa, 160),
      correo: P.limpiarTexto(v.correo, 160),
      telefono: P.limpiarTexto(v.telefono, 40),
      puerto: P.limpiarTexto(v.puerto, 60),
      mensaje: P.limpiarTexto(v.mensaje, 4000),
      aceptaDatos: true,
      origen: String(origen).slice(0, 64),
    };
    const id = await this.repo.guardarMensaje(m);
    try {
      const { correoContacto } = await this.config();
      if (correoContacto) {
        const aviso = P.avisoCorreo(m);
        const r = await this.correo.enviar({ para: correoContacto, asunto: aviso.asunto, texto: aviso.texto, responderA: m.correo });
        if (r.enviado && id) await this.repo.marcarNotificado(id);
        else if (!r.enviado) console.warn(`⚠️ [Portal] Mensaje ${id} guardado sin aviso por correo: ${r.razon}`);
      }
    } catch (error) {
      console.error(`❌ [Portal] Mensaje ${id} guardado; el aviso por correo falló:`, error?.message || error);
    }
    return { recibido: true };
  }
}

module.exports = new PortalService();
module.exports.PortalService = PortalService;
