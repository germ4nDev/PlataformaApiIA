/*
    Author: German Valencia
    Pattern: PORTTOS Service - Eventos viales
    Description: Dueño del ciclo de vida de los eventos viales (reglas en utils/eventos-viales.js):
      - obtenerEventosActivosGeoJSON(puerto): los vigentes como GeoJSON + origen (TomTom, último reporte y
        zonas que fallaron). Con ?puerto= se limitan al corredor del puerto (caja del puerto + margen terrestre).
      - aplicarReporte({ reportados, zonas }): lo llama la sincronización con TomTom cada 10 min. Reconcilia,
        escribe en una transacción, avisa al mapa por socket ('eventos-viales-cambio' a puerto:{P}:mapa) y
        pasa nuevos y despejados al motor de alertas (bitácora + notificación).
      - despejar(codigo, usuario): despeje manual del operador (motivo MANUAL).
      Acceso a datos en eventos-viales.repository.js.
*/
const EventosViales = require('../../repositories/torre-control/eventos-viales.repository');
const { cajaPuerto, puertosEnPunto, MARGEN } = require('../../helpers/caja-puerto.helper');
const { conTransaccion } = require('../../helpers/transaccion.helper');
const { emitir } = require('../../helpers/socket.helper');
const { salaPuerto } = require('../../helpers/salas.helper');
const { crearError, noEncontrado, migracionPendiente, validarCon } = require('../../helpers/errores.helper');
const { DespejarEventoParamsSchema } = require('../../models/torre-control/evento-vial.model');
const { origen } = require('../../utils/origen-dato');
const EV = require('../../utils/eventos-viales');

const EVENTO_SOCKET = 'eventos-viales-cambio';

class EventoVialService {
  constructor() {
    /** Resultado de la última sincronización con TomTom (en memoria; se pierde al reiniciar el API). */
    this.ultimaSincronizacion = null;   // { fecha: ISO, zonas: [{ nombre, ok, error }] }
  }

  /** @param {string} [puerto] filtro opcional: incidentes en el corredor del puerto */
  async obtenerEventosActivosGeoJSON(puerto, ahora = new Date()) {
    const caja = await cajaPuerto(puerto, MARGEN.TERRESTRE);
    const eventos = await EventosViales.activos(caja, { ahora });
    return {
      type: 'FeatureCollection',
      origen: this.origenEventos(ahora),
      features: eventos
        .filter((e) => e.lon != null && e.lat != null)
        .map((e) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [e.lon, e.lat] },
          properties: {
            id: e.codigoEvento,
            corredor: e.corredorVial,
            sector: e.sector,
            tipoEvento: e.tipoEvento,
            descripcion: e.descripcion,
            nivelSeveridad: e.nivelSeveridad,
            fechaInicio: e.fechaInicio,
            fechaFin: e.fechaFin || null,
            fuente: e.fuente || null,
            ultimoReporte: e.fechaUltimoReporte || null,
            manual: !!e.fuente && e.fuente !== EV.FUENTE_TOMTOM,
          },
        })),
    };
  }

  /** Origen de la capa: si la última sincronización falló en alguna zona, la nota lo dice. */
  origenEventos(ahora = new Date()) {
    const s = this.ultimaSincronizacion;
    const fallidas = (s?.zonas || []).filter((z) => !z.ok);
    const notas = [];
    if (!s) notas.push('Sin sincronización con TomTom desde que arrancó el API');
    else if (fallidas.length) {
      notas.push(`TomTom no respondió en ${fallidas.map((z) => z.nombre).join(', ')} (${fallidas[0].error || 'error'}); sus eventos siguen como estaban`);
    }
    return {
      ...origen({
        fuente: 'TomTom Traffic (incidentes vigentes) + reportes manuales',
        esRespaldo: !!s && fallidas.length === s.zonas.length,
        periodo: 'Vigentes ahora (se despejan al dejar de reportarse)',
        nota: notas,
      }, ahora),
      ultimaSincronizacion: s?.fecha || null,
      zonasFallidas: fallidas.map((z) => z.nombre),
    };
  }

  /**
   * Aplica una sincronización con TomTom: reconcilia, escribe, avisa al mapa y al motor de alertas.
   * @param {{ reportados: object[], zonas: Array<{nombre, bbox, ok, error}> }} p
   * @returns {Promise<{nuevos:number, vistos:number, ausentes:number, despejados:number, cicloDeVida:boolean}>}
   */
  async aplicarReporte({ reportados = [], zonas = [] }, ahora = new Date()) {
    this.ultimaSincronizacion = { fecha: ahora.toISOString(), zonas: zonas.map(({ nombre, ok, error }) => ({ nombre, ok, error })) };

    if (!(await EventosViales.conCicloDeVida())) {
      // Sin la migración 014: se guardan como antes y no se despeja nada
      for (const r of reportados) {
        const { fuente, zonaFuente, ...datos } = r;
        await EventosViales.guardar({ ...datos, fechaInicio: datos.fechaInicio || ahora.toISOString(), codigoUsuarioModificacion: 'SYS_CRON_TOMTOM', fechaModificacion: ahora });
      }
      return { nuevos: 0, vistos: reportados.length, ausentes: 0, despejados: 0, cicloDeVida: false };
    }

    const activos = await EventosViales.activosParaReconciliar();
    const cambios = EV.reconciliar({ reportados, activos, zonas, ahora });
    await conTransaccion((transaction) => EventosViales.aplicarCiclo(cambios, { transaction, ahora }));
    await this.notificar(cambios, ahora);
    return {
      nuevos: cambios.nuevos.length, vistos: cambios.vistos.length, ausentes: cambios.ausentes.length,
      despejados: cambios.resueltos.length, cicloDeVida: true,
    };
  }

  /** Despeje manual del operador. */
  async despejar(params, usuario, ahora = new Date()) {
    const { codigo } = validarCon(DespejarEventoParamsSchema, params);
    if (!(await EventosViales.conCicloDeVida())) throw migracionPendiente('014_eventos_viales_ciclo_vida.sql');
    const previo = await EventosViales.obtener(codigo);
    if (!previo) throw noEncontrado(`No existe el evento vial ${codigo}`);
    if (previo.estadoEvento !== EventosViales.ESTADO_ACTIVO) throw crearError(409, `El evento ${codigo} ya estaba ${String(previo.estadoEvento).toLowerCase()}`, 'YA_DESPEJADO');
    await conTransaccion((transaction) => EventosViales.despejar(codigo, { usuario, ahora, transaction }));
    const resuelto = {
      codigoEvento: codigo, motivo: EV.MOTIVO.MANUAL, fechaFin: ahora.toISOString(),
      duracionMin: EV.duracionMin(previo.fechaInicio, ahora), evento: previo,
    };
    await this.notificar({ nuevos: [], resueltos: [resuelto] }, ahora);
    return { codigo, estado: EventosViales.ESTADO_DESPEJADO, motivo: EV.MOTIVO.MANUAL, duracionMin: resuelto.duracionMin };
  }

  /**
   * Avisa a la sala del mapa de cada puerto afectado (el mapa recarga la capa) y al motor de alertas.
   * El motor de alertas se carga aquí (no arriba) porque él también lee este dominio.
   */
  async notificar({ nuevos = [], resueltos = [] }, ahora = new Date()) {
    if (!nuevos.length && !resueltos.length) return;
    const punto = (e) => {
      const c = e.ubicacion_geo?.coordinates;
      return c ? [Number(c[0]), Number(c[1])] : [Number(e.lon), Number(e.lat)];
    };
    const porPuerto = new Map();
    const anotar = async (e, clave) => {
      const [lon, lat] = punto(e);
      for (const p of await puertosEnPunto(lon, lat, MARGEN.TERRESTRE)) {
        if (!porPuerto.has(p)) porPuerto.set(p, { nuevos: [], despejados: [] });
        porPuerto.get(p)[clave].push(String(e.codigoEvento));
      }
    };
    for (const e of nuevos) await anotar(e, 'nuevos');
    for (const r of resueltos) await anotar({ ...r.evento, codigoEvento: r.codigoEvento }, 'despejados');
    porPuerto.forEach((cambio, puerto) => emitir(EVENTO_SOCKET, { puerto, ...cambio, fecha: ahora.toISOString() }, salaPuerto(puerto, 'mapa')));

    const AlertasMapaService = require('./alertas-mapa.service');
    await AlertasMapaService.evaluarEventosViales(nuevos, resueltos, ahora)
      .catch((error) => console.error('[EventosViales] No se pudieron publicar las alertas:', error.message));
  }
}

module.exports = new EventoVialService();
