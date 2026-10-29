/*
    Author: German Valencia
    Pattern: PORTTOS Service - Herramientas de lectura del asistente (capa de IA, fase 5)
    Description: Ejecuta las herramientas que pide el modelo (utils/ia/asistente.HERRAMIENTAS_DATOS) llamando a los
      servicios que ya existen. Nada escribe, nada ejecuta SQL escrito por el modelo. Cada resultado:
        - se resuelve el puerto (el de la pregunta o el que nombre la herramienta; 404 si no existe)
        - se reduce a lo útil para responder (sin series largas ni geometrías)
        - se seudonimizan placas (utils/ia/foto.seudonimizar)
        - se acota en tamaño (utils/ia/asistente.recortar)
      ejecutar(nombre, entrada, { puertoPorDefecto }) → texto JSON para el tool_result.
*/
const PuertosIA = require('./puertos-ia.service');
const FotoOperativa = require('./foto-operativa.service');
const Tendencias = require('./tendencias-ia.service');
const Analista = require('./analista.service');
const Resumenes = require('./resumenes-ia.service');
const MaritimoVivo = require('../torre-control/maritimo-vivo.service');
const { seudonimizar } = require('../../utils/ia/foto');
const { recortar, NOMBRES_DATOS } = require('../../utils/ia/asistente');
const { crearError } = require('../../helpers/errores.helper');

/** Recorre el resultado y seudonimiza todos los textos. */
const limpiar = (v) => {
  if (typeof v === 'string') return seudonimizar(v);
  if (Array.isArray(v)) return v.map(limpiar);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, limpiar(x)]));
  return v;
};
const quitarNulos = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined && v !== ''));

class HerramientasAsistenteService {
  constructor({ puertos = PuertosIA, fotos = FotoOperativa, tendencias = Tendencias, analista = Analista, resumenes = Resumenes, maritimo = MaritimoVivo } = {}) {
    Object.assign(this, { puertos, fotos, tendencias, analista, resumenes, maritimo });
  }

  async _puerto(entrada, puertoPorDefecto) {
    const nombre = String(entrada?.puerto || puertoPorDefecto || '').trim();
    if (!nombre) throw crearError(400, 'No hay puerto seleccionado: indica el puerto (usa listar_puertos para ver cuáles hay).', 'SIN_PUERTO');
    return this.puertos.resolver(nombre);       // 404 si no existe
  }

  async ejecutar(nombre, entrada = {}, { puertoPorDefecto = null } = {}) {
    if (!NOMBRES_DATOS.includes(nombre)) throw crearError(400, `Herramienta desconocida: ${nombre}`, 'HERRAMIENTA_DESCONOCIDA');
    const datos = await this[`_${nombre}`](entrada, puertoPorDefecto);
    return recortar(limpiar(datos));
  }

  async _listar_puertos() {
    return { puertos: (await this.puertos.activos()).map((p) => ({ clave: p.clave, nombre: p.nombre || p.clave })) };
  }

  async _foto_operativa(entrada, defecto) {
    const p = await this._puerto(entrada, defecto);
    const f = await this.fotos.foto({ puerto: p.clave });
    const pedidos = Array.isArray(entrada.modulos) && entrada.modulos.length ? entrada.modulos : null;
    const modulos = Object.fromEntries(Object.entries(f.modulos || {}).filter(([m]) => !pedidos || pedidos.includes(m)).map(([m, d]) => [m, {
      simulado: d.simulado, esRespaldo: d.esRespaldo,
      kpis: d.kpis.map((k) => quitarNulos({ id: k.id, titulo: k.titulo, valor: k.valor, unidad: k.unidad, umbrales: k.umbrales, simulado: k.simulado || null,
        ultimos: (k.serie || []).slice(-4) })),
    }]));
    const senales = (f.senales || []).filter((s) => !pedidos || pedidos.includes(String(s.id).split('.')[1]))
      .map((s) => ({ id: s.id, tipo: s.tipo, severidad: s.severidad, titulo: s.titulo, simulado: s.simulado || undefined }));
    return { puerto: p.nombre || p.clave, horaColombia: f.horaColombia, modulos, senales, alertasMapa: f.eventos?.alertas || [], eventosViales: f.eventos?.viales || [], calidad: f.calidad };
  }

  async _serie_kpi(entrada, defecto) {
    const p = await this._puerto(entrada, defecto);
    const r = await this.fotos.serieKpi({ puerto: p.clave }, { kpi: entrada.kpi, horas: entrada.horas || 24 });
    const paso = r.puntos.length > 96 ? Math.ceil(r.puntos.length / 96) : 1;      // a lo sumo ~96 puntos
    return { puerto: p.nombre || p.clave, kpi: r.kpi, horas: r.horas, cadaMin: 15 * paso, puntos: r.puntos.filter((_, i) => i % paso === 0) };
  }

  async _tendencias(entrada, defecto) {
    const p = await this._puerto(entrada, defecto);
    const r = await this.tendencias.tendencias({ puerto: p.clave }, quitarNulos({ ventana: entrada.ventana, modulo: entrada.modulo }));
    if (!r.disponible) return { puerto: p.nombre || p.clave, disponible: false, motivo: r.motivo };
    return {
      puerto: p.nombre || p.clave, comparacion: r.ventanas,
      destacadas: r.destacadas.map((d) => d.lectura),
      kpis: r.kpis.map((k) => ({
        codigo: k.codigo, titulo: k.titulo, unidad: k.unidad,
        ventanas: Object.fromEntries(Object.entries(k.ventanas).filter(([, t]) => t.direccion !== 'sin_datos').map(([w, t]) => [w, quitarNulos({
          actual: t.actual, referencia: t.referencia, cambioPct: t.cambioPct, direccion: t.direccion, efecto: t.efecto, simulado: t.simulado || null, lectura: t.lectura,
        })])),
      })).filter((k) => Object.keys(k.ventanas).length),
    };
  }

  async _alertas_tempranas(entrada, defecto) {
    const p = await this._puerto(entrada, defecto);
    const filas = await this.analista.hallazgos({ puerto: p.clave }, quitarNulos({ dias: entrada.dias || 3, estado: entrada.estado, limite: 40 }));
    return {
      puerto: p.nombre || p.clave,
      hallazgos: filas.filter((h) => h.clase !== 'RESUMEN').map((h) => quitarNulos({
        clase: h.clase, tipo: h.tipo, severidad: h.severidad, confianza: h.confianza, horizonteH: h.horizonteMinH !== null ? `${h.horizonteMinH}-${h.horizonteMaxH}` : null,
        titulo: h.titulo, explicacion: h.explicacion, accionSugerida: h.accionSugerida, estado: h.estado, resultado: h.resultado, fecha: h.fecha, vigenteHasta: h.vigenteHasta,
      })),
    };
  }

  async _resumenes_turno(entrada, defecto) {
    const p = await this._puerto(entrada, defecto);
    const r = await this.resumenes.resumenes({ puerto: p.clave }, quitarNulos({ tipo: entrada.tipo, dias: entrada.dias || 2, limite: 4 }));
    return {
      puerto: p.nombre || p.clave, disponible: r.disponible,
      resumenes: r.resumenes.map((x) => ({
        tipo: x.tipo, periodo: x.contenido?.periodo?.etiqueta, origen: x.contenido?.origen, titular: x.contenido?.titular || x.titulo,
        loQuePaso: x.contenido?.loQuePaso, loQueViene: x.contenido?.loQueViene, vigilar: x.contenido?.vigilar,
        tendencias: (x.contenido?.tendencias || []).map((t) => t.explicacion),
      })),
    };
  }

  async _estado_maritimo(entrada, defecto) {
    const p = await this._puerto(entrada, defecto);
    const [resumen, ocupacion] = await Promise.all([
      this.maritimo.resumen(p.clave, { vigenciaMin: 60, limiteCola: 15 }),
      this.maritimo.ocupacion(p.clave, { vigenciaMin: 60 }).catch(() => null),
    ]);
    return {
      puerto: p.nombre || p.clave, generadoEn: resumen.generadoEn, totalNaves: resumen.totalNaves, atracadas: resumen.atracadas,
      enMovimiento: resumen.enMovimiento, criticas: resumen.criticas,
      fondeo: { naves: resumen.fondeo?.naves, minutosPromedio: resumen.fondeo?.minutosPromedio, minutosMaximo: resumen.fondeo?.minutosMaximo,
        cola: (resumen.fondeo?.cola || []).map((n) => ({ nombre: n.nombre || n.mmsi, destino: n.destino, minutos: n.minutos })) },
      muelles: ocupacion ? {
        ...ocupacion.resumen,
        terminales: (ocupacion.terminales || []).map((t) => ({
          terminal: t.nombre, muelles: t.muelles.length, ocupados: t.muelles.filter((m) => m.ocupado).length,
          enMantenimiento: t.muelles.filter((m) => m.enMantenimiento).length,
          naves: t.muelles.flatMap((m) => m.naves.map((n) => ({ muelle: m.codigoMuelle, nave: n.nombre || n.mmsi, minutos: n.minutos }))),
        })),
      } : null,
    };
  }

  async _llegadas_buques(entrada, defecto) {
    const p = await this._puerto(entrada, defecto);
    const r = await this.maritimo.llegadas(p.clave, { horas: entrada.horas || 72, horasAtras: 12, limite: 30 });
    return {
      puerto: p.nombre || p.clave, horas: r.horas, resumen: r.resumen,
      naves: (r.naves || []).map((n) => quitarNulos({
        motonave: n.motonave, eta: n.eta, minutosParaEta: n.minutosParaEta, situacion: n.situacion, agencia: n.agencia,
        instalacion: n.instalacion, tipoNave: n.tipoNave, eslora: n.eslora, calado: n.calado, estadoAis: n.estadoAis,
      })),
    };
  }
}

module.exports = new HerramientasAsistenteService();
module.exports.HerramientasAsistenteService = HerramientasAsistenteService;
