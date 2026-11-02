/*
    Author: German Valencia
    Pattern: PORTTOS Service - Tablero móvil (app móvil)
    Description: Un endpoint por pestaña y puerto. Desde OT-008 (2026-10-29) el layout sale de la MISMA regla que la web
      (utils/layout/layout-efectivo.js) con los mismos datos de /api/layout (services/layout.service.js: layout del usuario
      y plantilla maestra; solo se leen) más el estado de cada widget del maestro (los inactivos no entran al por defecto).
      Todo widget del layout aparece en su celda; sin versión para el teléfono o sin dato, como tarjeta vacía con su título.
      Sin layout de usuario ni plantilla, la pestaña sale sin widgets (layout 'sin_layout'): no hay receta inventada.
        tablero({ puerto, pestana }, { fresco }, ahora, codigoUsuario)
          → { puerto, nombrePuerto, pestana, modulo, generadoEn, simulado, widgets (con `celda` x,y,cols,rows), fallidos, rejilla,
              layout: 'usuario' | 'defecto' | 'sin_layout', sinDatos: [codigo], sinVersionMovil: [codigo] }
      - Reutiliza los mismos servicios de los tableros de la web y las fotos de KPI de la capa de IA (series de 24 h).
      - El puerto puede ser cualquiera del maestro (404 si no existe); nada fijo a un puerto.
      - Cada fuente tiene tiempo límite; si una falla, sus widgets van a `sinDatos` y la fuente a `fallidos`.
      - Caché de 60 s por puerto y fuente (compartida entre usuarios) y por usuario y pestaña para el layout.
      - Solo lee el layout: no toca /api/layout ni /api/widgets.
*/
const PuertosIA = require('../ia/puertos-ia.service');
const FotoOperativa = require('../ia/foto-operativa.service');
const Snapshots = require('../../repositories/ia/snapshots-kpi.repository');
const LayoutMovil = require('../../repositories/movil/layout-movil.repository');
const LayoutService = require('../layout.service');
const PestanasMetadatos = require('../../repositories/pestanas-metadatos.repository');
const MaritimoVivo = require('../torre-control/maritimo-vivo.service');
const Noticias = require('../torre-control/noticias.service');
const GNL = require('../torre-control/gnl-telemetria.service');
const { validarCon } = require('../../helpers/errores.helper');
const { TableroMovilParamsSchema, TableroMovilQuerySchema } = require('../../models/movil/tablero-movil.model');
const { extraerKpis } = require('../../utils/ia/catalogo-kpi');
const { moduloDePestana } = require('../../utils/movil/tablero-movil');
const { fuentesDeLayout, armarWidgets, codigoMovil } = require('../../utils/movil/widgets-movil');
const { layoutEfectivo } = require('../../utils/layout/layout-efectivo');

const CACHE_MS = 60000;
const TIEMPO_FUENTE_MS = 20000;
const HORAS_SERIE = 24;
const USUARIO_POR_DEFECTO = 'SISTEMA_DEFAULT';
const MAX_CACHE = 500;

const conTiempo = (promesa, ms, nombre) => Promise.race([
  promesa,
  new Promise((_, rechazar) => setTimeout(() => rechazar(new Error(`${nombre}: sin respuesta en ${ms / 1000} s`)), ms)),
]);

/** Resumen operativo de Marítimo de la web (/maritimo/resumen); se carga al primer uso. */
const resumenMaritimo = (puerto) => require('../torre-control/maritimo.service').obtenerResumenOperativo(puerto);

const guardarEn = (mapa, llave, valor) => {
  mapa.set(llave, valor);
  if (mapa.size > MAX_CACHE) mapa.delete(mapa.keys().next().value);
};

class TableroMovilService {
  constructor({
    puertos = PuertosIA, fotos = FotoOperativa, snapshots = Snapshots, layouts = LayoutMovil, layoutWeb = new LayoutService(),
    metadatos = PestanasMetadatos,
    maritimo = MaritimoVivo, noticias = Noticias, gnl = GNL, maritimoResumen = resumenMaritimo, cacheMs = CACHE_MS,
  } = {}) {
    Object.assign(this, { puertos, fotos, snapshots, layouts, layoutWeb, metadatos, cacheMs });
    this.cacheFuentes = new Map();
    this.cacheLayouts = new Map();
    /** Fuentes que no están en la foto de la IA. Las del catálogo salen de FotoOperativa.fuentes. */
    this.extras = {
      llegadas: (p) => maritimo.llegadas(p.clave, { horas: 72, horasAtras: 6, limite: 20 }),
      noticias: (p, ahora) => noticias.tablero(p.nombre, ahora),
      gnl: (p, ahora) => gnl.serieHistorial(p.clave, HORAS_SERIE, ahora),
      maritimoResumen: (p) => maritimoResumen(p.nombre),
    };
  }

  async _fuente(nombre, p, ahora) {
    if (this.extras[nombre]) return this.extras[nombre](p, ahora);
    const f = this.fotos.fuentes?.[nombre];
    if (!f) throw new Error(`Fuente desconocida: ${nombre}`);
    return f(p.nombre, ahora);
  }

  /** Las fuentes pedidas, con caché de 60 s por puerto (varios teléfonos del mismo puerto no multiplican consultas). */
  async _fuentes(nombres, p, ahora, fresco) {
    const fuentes = {};
    const fallidos = [];
    const pendientes = [];
    for (const n of nombres) {
      const g = this.cacheFuentes.get(`${p.clave}|${n}`);
      if (!fresco && g && ahora.getTime() - g.en < this.cacheMs) fuentes[n] = g.valor;
      else pendientes.push(n);
    }
    const resultados = await Promise.allSettled(pendientes.map((n) => conTiempo(Promise.resolve().then(() => this._fuente(n, p, ahora)), TIEMPO_FUENTE_MS, n)));
    resultados.forEach((r, i) => {
      const n = pendientes[i];
      if (r.status === 'fulfilled' && r.value !== null && r.value !== undefined) {
        fuentes[n] = r.value;
        guardarEn(this.cacheFuentes, `${p.clave}|${n}`, { en: ahora.getTime(), valor: r.value });
      } else fallidos.push(n);
    });
    return { fuentes, fallidos };
  }

  /** Series de 24 h de los KPI del catálogo (sin la migración 015 no hay series: se sigue sin ellas). */
  async _series(clave, ahora) {
    const series = new Map();
    try {
      const desde = new Date(ahora.getTime() - HORAS_SERIE * 3600000).toISOString();
      for (const f of await this.snapshots.serie(clave, desde)) {
        if (!series.has(f.codigoKpi)) series.set(f.codigoKpi, []);
        series.get(f.codigoKpi).push(f);
      }
    } catch (error) {
      if (error?.codigo !== 'MIGRACION_PENDIENTE') console.warn('[MÓVIL] Series de KPI no disponibles:', error?.message || error);
    }
    return series;
  }

  /**
   * Datos del layout de la pestaña, los mismos que usa la web: filas del usuario y plantilla maestra (/api/layout), el estado
   * de cada widget del maestro y, de las tablas que mandan, la estrategia (PTLPestanas) y la zona dinámica
   * (PTLCfgZonasDinamicas): /api/layout/plantilla no las entrega bien (la web las toma de /api/pestanas).
   * La regla (layoutEfectivo) se aplica después, cuando se sabe cuántas terminales hay.
   * @returns {{ usuario: Array, plantilla: object, estados: Object, nombres: Object }}
   */
  async _datosLayout(codigoUsuario, pestana, ahora, fresco) {
    const usuario = codigoUsuario || USUARIO_POR_DEFECTO;
    const llave = `${usuario}|${pestana}`;
    const g = this.cacheLayouts.get(llave);
    if (!fresco && g && ahora.getTime() - g.en < this.cacheMs) return g.valor;
    let valor;
    try {
      const clave = String(pestana || '').trim().toUpperCase();
      const [propias, maestro, estrategias, zonas] = await Promise.all([
        this.layoutWeb.getLayoutByUsuario(usuario, pestana), this.layouts.maestro(pestana),
        this.metadatos.estrategias().catch(() => ({})), this.metadatos.zonas().catch(() => ({})),
      ]);
      const plantilla = propias.length ? null : await this.layoutWeb.getPlantillaMaestra(pestana);
      valor = {
        usuario: propias,
        plantilla: {
          estrategia: estrategias[clave] || plantilla?.estrategia || null,
          widgetsEstaticos: plantilla?.configuracion?.widgetsEstaticos || [],
          zonaDinamica: zonas[clave] || plantilla?.configuracion?.zonaDinamica || null,
        },
        estados: maestro.estados, nombres: maestro.nombres,
      };
    } catch (error) {
      console.warn('[MÓVIL] Layout no disponible:', error?.message || error);
      valor = { usuario: [], plantilla: null, estados: {}, nombres: {}, error: true };
    }
    guardarEn(this.cacheLayouts, llave, { en: ahora.getTime(), valor });
    return valor;
  }

  async tablero(params, query = {}, ahora = new Date(), codigoUsuario = null) {
    const { puerto, pestana } = validarCon(TableroMovilParamsSchema, params);
    const { fresco } = validarCon(TableroMovilQuerySchema, query);
    const p = await this.puertos.resolver(puerto);         // 404 si el puerto no existe
    const datos = await this._datosLayout(codigoUsuario, pestana, ahora, fresco);
    const modulo = moduloDePestana(pestana);

    // 1.ª pasada sin terminales: qué widgets hay y qué fuentes piden (las tarjetas de terminal piden el resumen marítimo)
    const previo = layoutEfectivo({ ...datos, terminales: null });
    const codigos = previo.celdas.map(codigoMovil);
    // Una pestaña con zona de terminales (o tarjetas guardadas) necesita saber cuántas tiene el puerto aunque la plantilla
    // aún no traiga ninguna tarjeta: el resumen marítimo las cuenta
    const manejaTerminales = previo.celdas.some((c) => c.idClon) || !!datos.plantilla?.zonaDinamica
      || String(datos.plantilla?.estrategia || '').toUpperCase() === 'CASCADA_DINAMICA';
    const nombresFuentes = [...new Set([...fuentesDeLayout(codigos), ...(manejaTerminales ? ['maritimoResumen'] : [])])];
    const { fuentes, fallidos } = await this._fuentes(nombresFuentes, p, ahora, fresco);
    const filas = extraerKpis(fuentes, p.clave, ahora);
    const series = filas.length ? await this._series(p.clave, ahora) : new Map();

    // 2.ª pasada con las terminales del puerto (null si el resumen no llegó: entonces el layout queda como está)
    const resumen = fuentes.maritimoResumen;
    const terminales = resumen ? (resumen.WDG_TERMINALES || []).length : null;
    const { origen, celdas } = layoutEfectivo({ ...datos, terminales });
    const { widgets, sinDatos, sinVersionMovil } = armarWidgets({
      celdas: celdas.map((c) => ({ ...c, codigo: codigoMovil(c) })), fuentes, filas, series, nombres: datos.nombres,
    });
    const simulado = widgets.some((w) => w.tipo === 'kpis' && w.items.some((k) => k.simulado))
      || Object.values(fuentes).some((f) => f && (f.simulado || f.origen?.simulado));
    return {
      puerto: p.clave, nombrePuerto: p.nombre, pestana, modulo, generadoEn: ahora.toISOString(), simulado: !!simulado,
      widgets, fallidos: datos.error ? [...fallidos, 'layout'] : fallidos, layout: origen, sinDatos, sinVersionMovil, rejilla: true,
    };
  }
}

module.exports = new TableroMovilService();
module.exports.TableroMovilService = TableroMovilService;
