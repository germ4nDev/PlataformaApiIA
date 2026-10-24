/*
    Author: German Valencia
    Pattern: PORTTOS Service - Noticias y actualidad (pestaña TLC_NOTICIAS)
    Description:
      - tablero(puerto): noticias guardadas, TRM, eventos viales activos en el corredor del puerto, alertas climáticas
        activas, clima actual de los puertos (Open-Meteo, caché 15 min) y fuentes oficiales/gremiales.
      - sincronizarNoticias(): proceso 'noticias' (cada 30 min). Por cada tema consulta Google News RSS y, si hay
        GNEWS_API_KEY, también GNews; guarda solo lo nuevo (sin repetidos entre proveedores).
      - sincronizarTrm(): proceso 'indicadores-mercado' (cada 6 h) desde datos.gov.co.
      - limpiar(): retención de 60 días.
*/
const NoticiasRepository = require('../../repositories/torre-control/noticias.repository');
const EventosVialesRepository = require('../../repositories/torre-control/eventos-viales.repository');
const AlertasClimaticasRepository = require('../../repositories/torre-control/alertas-climaticas.repository');
const NoticiasAdapter = require('../../adapters/noticias.adapter');
const OpenMeteo = require('../../adapters/open-meteo.adapter');
const { MAPA_PORTUARIO } = require('../../config/puertos.config');
const { contextoPuerto } = require('../../helpers/puerto-contexto.helper');
const { cajaPuerto, MARGEN } = require('../../helpers/caja-puerto.helper');
const { emitir } = require('../../helpers/socket.helper');
const { salaPuerto } = require('../../helpers/salas.helper');
const N = require('../../utils/noticias');

const CLIMA_TTL_MS = 15 * 60 * 1000;
const DIAS_FEED = 7;

/** Puertos y los nombres con que aparecen en la prensa (para marcar las noticias del puerto). */
const PUERTOS_PRENSA = Object.entries(MAPA_PORTUARIO).map(([clave, p]) => ({
  clave, nombres: [clave.replace(/_/g, ' '), p.nombre, ...(p.alias || [])].filter(Boolean),
}));

class NoticiasService {
  constructor({ repositorio = NoticiasRepository, adaptador = NoticiasAdapter, clima = OpenMeteo } = {}) {
    Object.assign(this, { repositorio, adaptador, climaAdapter: clima });
    this.clima = { hasta: 0, datos: [] };
    this.activo = null;   // false = falta la migración 013 (hasta reiniciar)
  }

  async tablero(puerto, ahora = new Date()) {
    const p = await contextoPuerto(puerto);
    const caja = await cajaPuerto(p.clave, MARGEN.TERRESTRE);
    const [noticias, trm, eventos, alertasClima, clima, fuentes] = await Promise.all([
      this.repositorio.recientes(new Date(ahora.getTime() - DIAS_FEED * 86400000).toISOString()),
      this.repositorio.indicador('TRM', 2),
      EventosVialesRepository.activos(caja).catch(() => []),
      AlertasClimaticasRepository.listar({ estadoAlerta: 'ACTIVO' }).catch(() => []),
      this.climaPuertos(ahora),
      this.repositorio.fuentes(),
    ]);
    return N.armarNoticias({ noticias, trm, eventos, alertasClima, clima, fuentes, puerto: p.clave }, ahora);
  }

  /** Vista ampliada: TRM de los últimos días (un valor por día). */
  async serieTrm(dias = 30) {
    const filas = await this.repositorio.indicador('TRM', dias * 6);
    return N.serieTrm(filas, dias);
  }

  /** Clima actual de los puertos configurados (viento en nudos, temperatura). */
  async climaPuertos(ahora = new Date()) {
    if (ahora.getTime() < this.clima.hasta) return this.clima.datos;
    const datos = await Promise.all(Object.entries(MAPA_PORTUARIO).map(async ([clave, p]) => {
      const c = p.coordenadas ? await this.climaAdapter.climaMarino(p.coordenadas.lat, p.coordenadas.lon) : null;
      return c ? { puerto: clave, nombre: p.nombre || clave.replace(/_/g, ' '), ...c } : null;
    }));
    this.clima = { hasta: ahora.getTime() + CLIMA_TTL_MS, datos: datos.filter(Boolean) };
    return this.clima.datos;
  }

  /** Consulta los temas en los proveedores y guarda lo nuevo. Devuelve cuántas noticias nuevas guardó. */
  async sincronizarNoticias(ahora = new Date()) {
    if (this.activo === false) return 0;
    const todas = [];
    const fallos = [];
    for (const tema of N.TEMAS) {
      const [google, gnews] = await Promise.all([
        this.adaptador.googleNews(tema.consulta).catch((e) => { fallos.push(`Google News ${tema.nombre}: ${e.message}`); return []; }),
        this.adaptador.gnews(tema.consulta).catch((e) => { fallos.push(`GNews ${tema.nombre}: ${e.message}`); return []; }),
      ]);
      google.forEach((i) => todas.push(N.prepararNoticia(i, { categoria: tema.categoria, proveedor: 'GOOGLE_NEWS', puertos: PUERTOS_PRENSA }, ahora)));
      gnews.forEach((i) => todas.push(N.prepararNoticia(i, { categoria: tema.categoria, proveedor: 'GNEWS', puertos: PUERTOS_PRENSA }, ahora)));
    }
    if (fallos.length) console.warn('[Noticias] Fuentes sin respuesta:', fallos.join(' | '));
    const recientes = N.sinRepetidos(todas).filter((n) => ahora.getTime() - Date.parse(n.fecha_publicacion) <= N.RETENCION_DIAS * 86400000);
    try {
      const nuevas = await this.repositorio.guardar(recientes);
      this.activo = true;
      if (nuevas > 0) this._avisar(recientes);
      return nuevas;
    } catch (error) {
      if (error?.codigo !== 'MIGRACION_PENDIENTE') throw error;
      console.warn('[Noticias] Falta la migración 013: sincronización apagada hasta reiniciar el API.');
      this.activo = false;
      return 0;
    }
  }

  /** Avisa a las salas de noticias de los puertos (todas reciben el feed nacional). */
  _avisar(noticias) {
    for (const { clave } of PUERTOS_PRENSA) {
      emitir('tablero-actualizado', { modulo: 'noticias', puerto: clave, nuevas: noticias.length }, salaPuerto(clave, 'noticias'));
    }
  }

  async sincronizarTrm(ahora = new Date()) {
    if (this.activo === false) return 0;
    const filas = await this.adaptador.trm(5);
    for (const f of filas) {
      await this.repositorio.guardarIndicador({ codigo: 'TRM', fecha: f.fecha, valor: f.valor, unidad: 'COP/USD', fuente: 'datos.gov.co 32sa-8pi3', fecha_ingesta: ahora.toISOString() });
    }
    return filas.length;
  }

  async limpiar(ahora = new Date()) {
    if (this.activo === false) return 0;
    await this.repositorio.purgar(new Date(ahora.getTime() - N.RETENCION_DIAS * 86400000).toISOString());
    return 0;
  }
}

module.exports = new NoticiasService();
module.exports.NoticiasService = NoticiasService;
