/*
    Author: German Valencia
    Pattern: PORTTOS Service - Tablero móvil (app móvil)
    Description: Un endpoint por pestaña y puerto. Desde 2026-10-24 el teléfono muestra los widgets del layout del
      usuario en la web (dbo.PTLLayouts) o, si no tiene, los del layout por defecto (dbo.PTLWidgetsMaestro inicial = 1),
      en el mismo orden de lectura (utils/movil/widgets-movil.js). Si la pestaña no tiene layout en ninguna de las dos,
      se usa la receta del módulo (utils/movil/tablero-movil.js, fase 2).
        tablero({ puerto, pestana }, { fresco }, ahora, codigoUsuario)
          → { puerto, nombrePuerto, pestana, modulo, generadoEn, simulado, widgets (con `celda` x,y,cols,rows), fallidos, rejilla,
              layout: 'usuario' | 'defecto' | 'modulo', soloWeb: [{ codigo, nombre }], sinDatos: [codigo] }
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
const MaritimoVivo = require('../torre-control/maritimo-vivo.service');
const Noticias = require('../torre-control/noticias.service');
const GNL = require('../torre-control/gnl-telemetria.service');
const { validarCon } = require('../../helpers/errores.helper');
const { TableroMovilParamsSchema, TableroMovilQuerySchema } = require('../../models/movil/tablero-movil.model');
const { extraerKpis } = require('../../utils/ia/catalogo-kpi');
const { armarTablero, moduloDePestana, FUENTES_POR_MODULO } = require('../../utils/movil/tablero-movil');
const { ordenarLayout, fuentesDeLayout, armarWidgets, celdasDeLayout } = require('../../utils/movil/widgets-movil');

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
    puertos = PuertosIA, fotos = FotoOperativa, snapshots = Snapshots, layouts = LayoutMovil,
    maritimo = MaritimoVivo, noticias = Noticias, gnl = GNL, maritimoResumen = resumenMaritimo, cacheMs = CACHE_MS,
  } = {}) {
    Object.assign(this, { puertos, fotos, snapshots, layouts, cacheMs });
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
   * Layout que ve el usuario en la web para esa pestaña: el suyo o el por defecto.
   * @returns {{ origen: 'usuario'|'defecto'|'modulo', codigos: string[], nombres: Object }}
   */
  async _layout(codigoUsuario, pestana, ahora, fresco) {
    const usuario = codigoUsuario || USUARIO_POR_DEFECTO;
    const llave = `${usuario}|${pestana}`;
    const g = this.cacheLayouts.get(llave);
    if (!fresco && g && ahora.getTime() - g.en < this.cacheMs) return g.valor;
    let valor;
    try {
      const [propias, nombres] = await Promise.all([this.layouts.deUsuario(usuario, pestana), this.layouts.nombres(pestana)]);
      if (propias.length) valor = { origen: 'usuario', codigos: ordenarLayout(propias), filas: propias, zona: null, nombres };
      else {
        const defecto = await this.layouts.porDefecto(pestana);
        const zona = defecto.length && moduloDePestana(pestana) === 'maritimo' ? await this.layouts.zonaDinamica(pestana) : null;
        valor = defecto.length
          ? { origen: 'defecto', codigos: ordenarLayout(defecto, { zonaY: zona?.inicioY ?? null }), filas: defecto, zona, nombres }
          : { origen: 'modulo', codigos: [], nombres };
      }
    } catch (error) {
      console.warn('[MÓVIL] Layout no disponible, se usa la receta del módulo:', error?.message || error);
      valor = { origen: 'modulo', codigos: [], nombres: {} };
    }
    guardarEn(this.cacheLayouts, llave, { en: ahora.getTime(), valor });
    return valor;
  }

  async tablero(params, query = {}, ahora = new Date(), codigoUsuario = null) {
    const { puerto, pestana } = validarCon(TableroMovilParamsSchema, params);
    const { fresco } = validarCon(TableroMovilQuerySchema, query);
    const p = await this.puertos.resolver(puerto);         // 404 si el puerto no existe
    const layout = await this._layout(codigoUsuario, pestana, ahora, fresco);

    const modulo = moduloDePestana(pestana);
    const nombresFuentes = layout.codigos.length ? fuentesDeLayout(layout.codigos) : (FUENTES_POR_MODULO[modulo] || []);
    const { fuentes, fallidos } = await this._fuentes(nombresFuentes, p, ahora, fresco);
    const filas = extraerKpis(fuentes, p.clave, ahora);
    const series = filas.length ? await this._series(p.clave, ahora) : new Map();

    if (!layout.codigos.length) {
      return { ...armarTablero({ puerto: p.clave, pestana, fuentes, filas, series, ahora }), nombrePuerto: p.nombre, fallidos, layout: 'modulo', soloWeb: [], sinDatos: [] };
    }
    // Rejilla tipo gridster (fase A): las celdas del layout; las tarjetas de terminal se rehacen para las terminales del puerto
    const terminales = (fuentes.maritimoResumen?.WDG_TERMINALES || []).length;
    const celdas = layout.filas?.length ? celdasDeLayout(layout.filas, { zona: layout.zona, terminales }) : null;
    const { widgets, soloWeb, sinDatos } = armarWidgets({ codigos: layout.codigos, celdas, fuentes, filas, series, nombres: layout.nombres });
    const simulado = widgets.some((w) => w.tipo === 'kpis' && w.items.some((k) => k.simulado))
      || Object.values(fuentes).some((f) => f && (f.simulado || f.origen?.simulado));
    return {
      puerto: p.clave, nombrePuerto: p.nombre, pestana, modulo, generadoEn: ahora.toISOString(), simulado: !!simulado,
      widgets, fallidos, layout: layout.origen, soloWeb, sinDatos, rejilla: !!celdas,
    };
  }
}

module.exports = new TableroMovilService();
module.exports.TableroMovilService = TableroMovilService;
