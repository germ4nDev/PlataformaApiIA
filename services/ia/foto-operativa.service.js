/*
    Author: German Valencia
    Pattern: PORTTOS Service - Foto operativa y señales de la capa de IA (fase 1, sin modelo)
    Description: Orquesta los servicios de los tableros, los núcleos puros de utils/ia y el repositorio de fotos.
      - tomarFotos(): cron 'ia-fotos' cada 15 min; guarda los KPI del catálogo de cada puerto activo (IA_PUERTOS:
        TODOS = cada puerto del maestro con geocerca), de a 3 puertos a la vez.
      - foto(puerto): la foto operativa del momento (KPI + series + señales + alertas + eventos viales), la misma que
        verá el analista IA; hoy se muestra en el endpoint de diagnóstico para revisar qué «ve» el sistema.
      - senales(puerto), serieKpi(puerto, kpi, horas), estado(), limpiar().
      Un módulo que falla no tumba la foto: queda en calidad.modulosSinDato. Sin la migración 015 la foto se arma
      igual con los valores del momento (sin series) y las fotos se apagan hasta reiniciar.
      Interruptores: config/ia.config.js (IA_SNAPSHOTS_ENABLED, IA_ENABLED, IA_PUERTOS, IA_RETENCION_DIAS).
*/
const { configIA } = require('../../config/ia.config');
const Snapshots = require('../../repositories/ia/snapshots-kpi.repository');
const PuertosIA = require('./puertos-ia.service');
const { enLotes } = require('../../utils/ia/lotes');
const EventosViales = require('../../repositories/torre-control/eventos-viales.repository');
const MaritimoVivo = require('../torre-control/maritimo-vivo.service');
const VirtualGate = require('../torre-control/virtual-gate.service');
const { obtenerDatosContenedores } = require('../torre-control/contenedores.service');
const Bodegas = require('../torre-control/bodegas.service');
const Tableros = require('../torre-control/tableros-operacion.service');
const { cajaPuerto, MARGEN } = require('../../helpers/caja-puerto.helper');
const { validarCon } = require('../../helpers/errores.helper');
const { PuertoParamsSchema, SerieKpiQuerySchema } = require('../../models/ia/analisis-ia.model');
const { extraerKpis, CATALOGO_KPI } = require('../../utils/ia/catalogo-kpi');
const { evaluarSenales } = require('../../utils/ia/senales');
const { armarFoto } = require('../../utils/ia/foto');

const VIGENCIA_AIS_MIN = 60;
const DIAS_SERIE = 7;
const TIEMPO_MODULO_MS = 30000;
const PUERTOS_A_LA_VEZ = 3;

/** Promesa con tiempo límite: un tablero lento no frena la foto. */
const conTiempo = (promesa, ms, modulo) => Promise.race([
  promesa,
  new Promise((_, rechazar) => setTimeout(() => rechazar(new Error(`${modulo}: sin respuesta en ${ms / 1000} s`)), ms)),
]);

class FotoOperativaService {
  constructor({ config = configIA, snapshots = Snapshots, puertos = PuertosIA } = {}) {
    this.config = config;
    this.snapshots = snapshots;
    this.puertos = puertos;
    this.sinMigracion = false;
    this.ultimoCiclo = null;   // { fecha, puertos: [{ puerto, kpis, fallidos }] }
    /** Cómo se obtiene la fuente de cada módulo del catálogo (inyectable en pruebas). */
    this.fuentes = {
      maritimo: async (p) => {
        const [resumen, ocupacion] = await Promise.all([
          MaritimoVivo.resumen(p, { vigenciaMin: VIGENCIA_AIS_MIN, limiteCola: 20 }),
          MaritimoVivo.ocupacion(p, { vigenciaMin: VIGENCIA_AIS_MIN }),
        ]);
        return { resumen, ocupacion };
      },
      gate: async (p, ahora) => (await VirtualGate.obtenerDashboardVirtualGate(p, ahora))?.virtualGate,
      contenedores: (p, ahora) => obtenerDatosContenedores(p, ahora),
      bodegas: (p, ahora) => Bodegas.obtenerDashboardBodegasPorPuerto(p, ahora),
      granel: (p, ahora) => Tableros.granel(p, ahora),
      suelta: (p, ahora) => Tableros.cargaSuelta(p, ahora),
      capacidad: (p, ahora) => Tableros.capacidad(p, ahora),
      viales: async (p, ahora) => ({ eventos: await EventosViales.activos(await cajaPuerto(p, MARGEN.TERRESTRE), { ahora }) }),
    };
  }

  /** Salidas de los servicios de cada módulo; los que fallan van a fallidos. */
  async recolectar(puerto, ahora = new Date()) {
    const modulos = Object.keys(this.fuentes);
    const resultados = await Promise.allSettled(modulos.map((m) => conTiempo(Promise.resolve().then(() => this.fuentes[m](puerto, ahora)), TIEMPO_MODULO_MS, m)));
    const fuentes = {};
    const fallidos = [];
    resultados.forEach((r, i) => {
      if (r.status === 'fulfilled' && r.value !== undefined && r.value !== null) fuentes[modulos[i]] = r.value;
      else fallidos.push({ modulo: modulos[i], error: r.reason?.msg || r.reason?.message || 'sin datos' });
    });
    return { fuentes, fallidos };
  }

  /** Cron 'ia-fotos': guarda los KPI de cada puerto activo, de a PUERTOS_A_LA_VEZ. */
  async tomarFotos(ahora = new Date()) {
    if (!this.config.fotosHabilitadas || this.sinMigracion) return { insertados: 0, omitido: true };
    const activos = await this.puertos.activos();
    const resultados = await enLotes(activos, PUERTOS_A_LA_VEZ, async (p) => {
      if (this.sinMigracion) return { puerto: p.clave, kpis: 0, omitido: true };
      const { fuentes, fallidos } = await this.recolectar(p.nombre, ahora);
      const filas = extraerKpis(fuentes, p.clave, ahora);
      try {
        return { puerto: p.clave, kpis: filas.length, insertados: await this.snapshots.guardar(filas), fallidos: fallidos.map((f) => f.modulo) };
      } catch (error) {
        if (error?.codigo === 'MIGRACION_PENDIENTE') {
          if (!this.sinMigracion) console.warn('[IA] Sin migración 015: las fotos de KPI quedan apagadas hasta reiniciar el API.');
          this.sinMigracion = true;
          return { puerto: p.clave, kpis: 0, omitido: true };
        }
        throw error;
      }
    });
    if (this.sinMigracion) return { insertados: 0, omitido: true };
    const puertos = resultados.map((r, i) => (r.ok ? r.valor : { puerto: activos[i].clave, error: r.error?.msg || r.error?.message }));
    this.ultimoCiclo = { fecha: ahora.toISOString(), puertos };
    return { insertados: puertos.reduce((t, p) => t + (p.insertados || 0), 0), puertos: puertos.length };
  }

  /** Series de los últimos 7 días + la foto actual, por KPI. */
  async _series(puerto, actuales, ahora) {
    const series = new Map(CATALOGO_KPI.map((d) => [d.codigo, []]));
    let historia = true;
    try {
      const desde = new Date(ahora.getTime() - DIAS_SERIE * 86400000).toISOString();
      (await this.snapshots.serie(puerto, desde)).forEach((f) => series.get(f.codigoKpi)?.push(f));
    } catch (error) {
      if (error?.codigo !== 'MIGRACION_PENDIENTE') throw error;
      historia = false;
    }
    actuales.forEach((f) => {
      const s = series.get(f.codigoKpi);
      if (!s) return;
      if (s.length && s[s.length - 1].fecha === f.fecha) s[s.length - 1] = f;   // misma foto de este cuarto de hora
      else s.push(f);
    });
    return { series, historia };
  }

  /** Foto operativa del puerto en este momento (lo que verá el analista IA). */
  async foto(params, ahora = new Date()) {
    const { puerto } = validarCon(PuertoParamsSchema, params);
    const p = await this.puertos.resolver(puerto);     // cualquier puerto del maestro; 404 si no existe
    const clave = p.clave;
    const [{ fuentes, fallidos }, alertas] = await Promise.all([
      this.recolectar(p.nombre, ahora),
      this._bitacora(clave),
    ]);
    const actuales = extraerKpis(fuentes, clave, ahora);
    const { series, historia } = await this._series(clave, actuales, ahora);
    const senales = evaluarSenales(series, ahora);
    const foto = armarFoto({
      puerto: clave, actuales, series, senales, alertas, viales: fuentes.viales?.eventos || [], modulosFallidos: fallidos, ahora,
    });
    return { ...foto, historiaDisponible: historia, iaHabilitada: this.config.habilitada, puertoActivo: await this.puertos.habilitado(clave) };
  }

  async senales(params, ahora = new Date()) {
    const f = await this.foto(params, ahora);
    return { puerto: f.puerto, generadoEn: f.generadoEn, historiaDisponible: f.historiaDisponible, senales: f.senales, calidad: f.calidad };
  }

  /** Serie guardada de un KPI (diagnóstico y, más adelante, la vista de tendencias). */
  async serieKpi(params, query, ahora = new Date()) {
    const { puerto } = validarCon(PuertoParamsSchema, params);
    const { kpi, horas } = validarCon(SerieKpiQuerySchema, query);
    const desde = new Date(ahora.getTime() - horas * 3600000).toISOString();
    const { clave } = await this.puertos.resolver(puerto);
    const filas = (await this.snapshots.serie(clave, desde)).filter((f) => f.codigoKpi === kpi);
    return { puerto: clave, kpi, horas, puntos: filas.map((f) => ({ fecha: f.fecha, valor: f.valor, simulado: !!f.simulado })) };
  }

  /** Interruptores, migración y último ciclo (sin secretos). */
  async estado() {
    const puertos = [];
    const activos = await this.puertos.activos();
    for (const { clave: puerto } of activos) {
      try {
        puertos.push({ puerto, ...(await this.snapshots.estado(puerto)) });
      } catch (error) {
        if (error?.codigo !== 'MIGRACION_PENDIENTE') throw error;
        puertos.push({ puerto, fotos: null, nota: 'Falta la migración 015_analisis_ia.sql' });
      }
    }
    return {
      iaHabilitada: this.config.habilitada,
      fotosHabilitadas: this.config.fotosHabilitadas && !this.sinMigracion,
      modoPuertos: this.config.puertos.includes('TODOS') ? 'TODOS (maestro con geocerca)' : this.config.puertos.join(', '),
      puertos: activos.map((p) => p.clave),
      retencionDias: this.config.retencionDias,
      kpisEnCatalogo: CATALOGO_KPI.length,
      ultimoCiclo: this.ultimoCiclo,
      fotos: puertos,
    };
  }

  /** Cron 'ia-limpieza': retención de las fotos. */
  async limpiar(ahora = new Date()) {
    if (this.sinMigracion) return 0;
    const antes = new Date(ahora.getTime() - this.config.retencionDias * 86400000).toISOString();
    try {
      return await this.snapshots.purgar(antes);
    } catch (error) {
      if (error?.codigo === 'MIGRACION_PENDIENTE') { this.sinMigracion = true; return 0; }
      throw error;
    }
  }

  /** Últimas alertas del mapa del puerto (el motor de alertas se carga aquí: también lee servicios de tableros). */
  async _bitacora(clave) {
    try {
      return await require('../torre-control/alertas-mapa.service').bitacora(clave, 10);
    } catch {
      return [];
    }
  }
}

module.exports = new FotoOperativaService();
module.exports.FotoOperativaService = FotoOperativaService;
