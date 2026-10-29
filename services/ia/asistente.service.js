/*
    Author: German Valencia
    Pattern: PORTTOS Service - Asistente de Porttos (capa de IA, fase 5)
    Description: Responde preguntas de los usuarios sobre la operación, solo dentro del marco de alcance.
      preguntar(body, usuario):
        1. Interruptores: IA_ENABLED, IA_ASISTENTE_ENABLED y la tarea 'asistente' del puerto (panel de IA).
        2. Tope de preguntas por usuario y día (IA_ASISTENTE_TOPE_USUARIO_DIA, sobre TCL_IAPreguntas).
        3. Marco de alcance (utils/ia/alcance): reglas sin costo; si quedan dudas, el clasificador barato
           (tarea 'filtro', IA_MODELO_FILTRO). Fuera de alcance → respuesta amable con ejemplos, sin llamar al asistente.
        4. Asistente (tarea 'asistente', IA_MODELO_ASISTENTE) con herramientas de solo lectura
           (services/ia/herramientas-asistente) vía Cerebro.conversar: presupuesto, cortacircuito y registro.
        5. Verificación: las cifras de la respuesta deben estar en lo que devolvieron las herramientas; las que no,
           se devuelven en 'verificacion.sinRespaldo' para que el front lo avise. Fuentes = herramientas usadas.
        6. Registro en TCL_IAPreguntas (migración 018); sin ella, responde igual sin guardar.
      feedback(params, body, usuario)   «útil / no era» de una respuesta (solo el que preguntó)
      Panel: adminPreguntas(query), adminTemas(), guardarTema(body, usuario), probarAlcance(body)
*/
const crypto = require('crypto');
const { configIA } = require('../../config/ia.config');
const Cerebro = require('./cerebro.service');
const ConfigIA = require('./config-ia.service');
const PuertosIA = require('./puertos-ia.service');
const Herramientas = require('./herramientas-asistente.service');
const AsistenteRepo = require('../../repositories/ia/asistente-ia.repository');
const AnalisisRepo = require('../../repositories/ia/analisis-ia.repository');
const A = require('../../utils/ia/alcance');
const { PROMPT_ASISTENTE, armarSolicitudAsistente, verificarCifras, NOMBRES_DATOS } = require('../../utils/ia/asistente');
const { desdeFila } = require('../../utils/ia/prompts');
const { resolverConfig } = require('../../utils/ia/config-efectiva');
const { inicioDiaColombia } = require('../../utils/tablero-comun');
const { validarCon, crearError } = require('../../helpers/errores.helper');
const {
  PreguntaSchema, PreguntaParamsSchema, FeedbackPreguntaSchema, AdminAsistenteQuerySchema, TemaAlcanceSchema,
  validarSalidaFiltro, validarRespuestaAsistente,
} = require('../../models/ia/analisis-ia.model');

const TTL_TEMAS_MS = 5 * 60 * 1000;
const DIA = 86400000;
const TODOS = /^(TODOS|ALL|\*)$/i;
const sinMigracion = (e) => e?.codigo === 'MIGRACION_PENDIENTE';
const parse = (t, d) => { try { return t ? JSON.parse(t) : d; } catch { return d; } };
const horaColombia = (ahora) => new Date(ahora.getTime() - 5 * 3600000).toISOString().replace('T', ' ').slice(0, 16);

const MENSAJES = {
  APAGADO: 'El asistente de Porttos está apagado en este momento. Mientras tanto puedes consultar los tableros y el widget Analista IA.',
  APAGADO_PUERTO: 'El asistente está apagado para este puerto. Un administrador lo puede encender en Administración IA.',
  TOPE_USUARIO: 'Llegaste al máximo de preguntas al asistente por hoy. Mañana se renueva el cupo.',
  OMITIDA_PRESUPUESTO: 'El asistente llegó al presupuesto del día para este puerto. Intenta más tarde o consulta los tableros.',
  CORTACIRCUITO: 'El servicio de IA está fallando y está en pausa unos minutos. Intenta de nuevo en un rato.',
  ERROR: 'No pude completar la respuesta por un error del servicio de IA. Intenta de nuevo.',
  INVALIDA: 'No logré armar una respuesta confiable a esa pregunta. Intenta formularla de otra manera.',
  OMITIDA_APAGADA: 'El asistente de Porttos está apagado en este momento.',
};

class AsistenteService {
  constructor({ config = configIA, cerebro = Cerebro, repo = AsistenteRepo, analisis = AnalisisRepo, puertos = PuertosIA,
    herramientas = Herramientas, ajustes = null, simulacion = null } = {}) {
    Object.assign(this, { config, cerebro, repo, analisis, puertos, herramientas, simulacion });
    this.ajustes = ajustes || (config === configIA ? ConfigIA : { efectiva: async (p, t) => resolverConfig([], p, t, config) });
    this.cacheTemas = { hasta: 0, temas: null, filas: [], disponible: false };
  }

  async _temas(ahoraMs = Date.now()) {
    if (this.cacheTemas.temas && ahoraMs < this.cacheTemas.hasta) return this.cacheTemas;
    let filas = [];
    let disponible = true;
    try { filas = await this.repo.temasAlcance(); } catch (error) {
      disponible = false;
      if (!sinMigracion(error)) console.error('[IA] No se pudo leer TCL_IAAlcance:', error?.msg || error?.message);
    }
    this.cacheTemas = { hasta: ahoraMs + TTL_TEMAS_MS, temas: A.temasEfectivos(filas), filas, disponible };
    return this.cacheTemas;
  }

  async _prompt(tarea, incorporado) {
    try { return desdeFila(await this.analisis.promptActivo(tarea), incorporado); } catch (error) {
      if (!sinMigracion(error)) throw error;
      return incorporado;
    }
  }

  async _registrar(fila) {
    try { return await this.repo.registrarPregunta(fila); } catch (error) {
      if (!sinMigracion(error)) console.error('[IA] No se pudo guardar la pregunta:', error?.msg || error?.message);
      return null;
    }
  }

  /** POST /api/analisis-ia/asistente/preguntar */
  async preguntar(body, usuario, ahora = new Date()) {
    const t0 = Date.now();
    const v = validarCon(PreguntaSchema, body);
    const salida = (extra) => ({ id: null, puerto: null, decision: null, tema: null, respuesta: '', fuentes: [], sugerencias: [], verificacion: null, herramientas: [], ...extra });

    if (!this.config.habilitada || !this.config.asistenteHabilitado) return salida({ estado: 'APAGADO', respuesta: MENSAJES.APAGADO });
    let p = null;
    if (v.puerto && !TODOS.test(v.puerto)) p = await this.puertos.resolver(v.puerto);       // 404 si no existe
    const clave = p?.clave || null;
    const cfg = await this.ajustes.efectiva(clave || '*', 'asistente');
    if (!cfg.activa) return salida({ estado: 'APAGADO', puerto: clave, respuesta: MENSAJES.APAGADO_PUERTO });

    let hoy = 0;
    try { hoy = await this.repo.preguntasDelDia(usuario, new Date(inicioDiaColombia(ahora.getTime())).toISOString()); } catch (error) { if (!sinMigracion(error)) throw error; }
    if (hoy >= this.config.topePreguntasUsuarioDia) return salida({ estado: 'TOPE_USUARIO', puerto: clave, respuesta: MENSAJES.TOPE_USUARIO });

    const { temas } = await this._temas(ahora.getTime());
    const base = { usuario, puerto: clave, pestana: v.pestana || null, pregunta: v.pregunta };
    const anterior = v.historial.length ? v.historial[v.historial.length - 1].pregunta : null;

    // 1. Alcance: reglas (con la pregunta anterior si es un seguimiento) y, si hace falta, el clasificador
    let pre = A.prefiltro(v.pregunta, temas);
    if (pre.decision === 'dudoso' && anterior) {
      const conAnterior = A.prefiltro(`${anterior} ${v.pregunta}`, temas);
      if (['dentro', 'frontera'].includes(conAnterior.decision)) pre = { ...conAnterior, motivo: `${conAnterior.motivo} (seguimiento)` };
    }
    let clasif = null;
    let idEjecucionFiltro = null;
    if (pre.decision === 'dudoso') {
      const cfgFiltro = await this.ajustes.efectiva(clave || '*', 'filtro');
      if (cfgFiltro.activa) {
        const prompt = await this._prompt('filtro', A.PROMPT_FILTRO);
        const huella = crypto.createHash('sha256').update(`${anterior || ''}|${v.pregunta}|${temas.map((t) => `${t.codigo}:${t.activo}`).join(',')}`).digest('hex').slice(0, 32);
        const r = await this.cerebro.ejecutar({
          tarea: 'filtro', puerto: clave || '*', prompt, modelo: prompt.modelo || this.config.modeloFiltro,
          solicitud: A.armarSolicitudFiltro(v.pregunta, anterior, temas, prompt), hash: huella, validar: validarSalidaFiltro,
          topes: { llamadas: cfgFiltro.topeLlamadasDia, tokens: cfgFiltro.topeTokensDia }, contexto: { clasificacion: this.simulacion?.clasificacion },
        }, ahora);
        idEjecucionFiltro = r.idEjecucion ?? null;
        if (r.estado === 'OK') clasif = r.valor;
      }
    }
    const dec = A.decisionFinal(pre, clasif);

    if (dec.decision === 'fuera') {
      const f = A.respuestaFuera(pre, temas, { modulo: null, tema: dec.tema });
      const id = await this._registrar({ ...base, decision: 'fuera', origenDecision: dec.origen, tema: dec.tema, motivo: dec.motivo, estado: 'RECHAZADA', respuesta: f.respuesta, idEjecucionFiltro, latenciaMs: Date.now() - t0 });
      return salida({ id, estado: 'RECHAZADA', puerto: clave, decision: 'fuera', tema: dec.tema, motivo: dec.motivo, respuesta: f.respuesta, sugerencias: f.sugerencias });
    }

    // 2. Asistente con herramientas de lectura
    const prompt = await this._prompt('asistente', PROMPT_ASISTENTE);
    const solicitud = armarSolicitudAsistente({
      pregunta: v.pregunta, historial: v.historial,
      contexto: { puerto: clave, nombre: p?.nombre || null, horaColombia: horaColombia(ahora), pestana: v.pestana || null, decision: dec.decision, temas },
    }, prompt);
    const r = await this.cerebro.conversar({
      tarea: 'asistente', puerto: clave || '*', prompt, modelo: prompt.modelo || this.config.modeloAsistente, solicitud,
      ejecutar: (nombre, entrada) => this.herramientas.ejecutar(nombre, entrada, { puertoPorDefecto: clave }),
      validar: validarRespuestaAsistente, maxPasos: 6, topes: { llamadas: cfg.topeLlamadasDia, tokens: cfg.topeTokensDia },
      contexto: { simulacion: this.simulacion },
    }, ahora);
    const usadas = r.herramientas || [];
    const nombresUsadas = [...new Set(usadas.map((h) => h.nombre))];

    if (r.estado !== 'OK') {
      const respuesta = MENSAJES[r.estado] || MENSAJES.ERROR;
      const id = await this._registrar({ ...base, decision: dec.decision, origenDecision: dec.origen, tema: dec.tema, motivo: (r.motivo || dec.motivo || '').slice(0, 200),
        estado: r.estado, respuesta, herramientas: usadas, idEjecucion: r.idEjecucion, idEjecucionFiltro, latenciaMs: Date.now() - t0 });
      return salida({ id, estado: r.estado, puerto: clave, decision: dec.decision, tema: dec.tema, respuesta, herramientas: nombresUsadas });
    }

    const valor = r.valor;
    if (valor.fueraDeAlcance) {
      const f = A.respuestaFuera(pre, temas, { tema: dec.tema });
      const id = await this._registrar({ ...base, decision: 'fuera', origenDecision: 'asistente', tema: dec.tema, motivo: 'el asistente la marcó fuera de alcance',
        estado: 'RECHAZADA', respuesta: valor.respuesta, herramientas: usadas, idEjecucion: r.idEjecucion, idEjecucionFiltro, latenciaMs: Date.now() - t0 });
      return salida({ id, estado: 'RECHAZADA', puerto: clave, decision: 'fuera', tema: dec.tema, respuesta: valor.respuesta || f.respuesta, sugerencias: f.sugerencias });
    }

    const verificacion = verificarCifras(valor.respuesta, r.resultados || []);
    const fuentes = valor.fuentes.filter((f) => nombresUsadas.includes(f.herramienta) || /conocimiento/i.test(f.herramienta) || !NOMBRES_DATOS.includes(f.herramienta) && /general/i.test(f.detalle));
    const estado = valor.sinDatos ? 'SIN_DATOS' : 'RESPONDIDA';
    const id = await this._registrar({
      ...base, decision: dec.decision, origenDecision: dec.origen, tema: dec.tema, motivo: dec.motivo, estado, respuesta: valor.respuesta, fuentes,
      herramientas: usadas, verificacion: verificacion.ok ? null : `cifras sin respaldo: ${verificacion.sinRespaldo.join(', ')}`,
      idEjecucion: r.idEjecucion, idEjecucionFiltro, latenciaMs: Date.now() - t0,
    });
    return salida({
      id, estado, puerto: clave, decision: dec.decision, tema: dec.tema, respuesta: valor.respuesta, fuentes,
      sugerencias: valor.sugerencias.length ? valor.sugerencias : A.sugerencias(temas, { tema: dec.tema }), verificacion, herramientas: nombresUsadas,
    });
  }

  /** «Útil / no era» de una respuesta; solo quien preguntó. */
  async feedback(params, body, usuario) {
    const { id } = validarCon(PreguntaParamsSchema, params);
    const { util, comentario } = validarCon(FeedbackPreguntaSchema, body);
    const p = await this.repo.obtenerPregunta(id);
    if (!p) throw crearError(404, `No existe la pregunta ${id}`, 'PREGUNTA_NO_EXISTE');
    if (String(p.usuario) !== String(usuario)) throw crearError(403, 'Solo quien hizo la pregunta puede calificar la respuesta', 'NO_ES_TU_PREGUNTA');
    await this.repo.votarPregunta(id, util, comentario);
    return { id, util };
  }

  // ── Panel de administración ──────────────────────────────────────────────────────────────────────

  async adminPreguntas(query = {}, ahora = new Date()) {
    const { dias, decision, limite } = validarCon(AdminAsistenteQuerySchema, query);
    const desde = new Date(ahora.getTime() - dias * DIA).toISOString();
    try {
      const [resumen, filas] = await Promise.all([this.repo.resumenPreguntas(desde), this.repo.preguntas({ desdeIso: desde, decision: decision || null, limite })]);
      const total = (pred) => resumen.filter(pred).reduce((t, f) => t + (Number(f.cantidad) || 0), 0);
      const utiles = resumen.reduce((t, f) => t + (Number(f.utiles) || 0), 0);
      const noUtiles = resumen.reduce((t, f) => t + (Number(f.noUtiles) || 0), 0);
      return {
        disponible: true, dias,
        conteos: { total: total(() => true), dentro: total((f) => f.decision === 'dentro'), frontera: total((f) => f.decision === 'frontera'),
          fuera: total((f) => f.decision === 'fuera'), sinDatos: total((f) => f.estado === 'SIN_DATOS'), errores: total((f) => !['RESPONDIDA', 'RECHAZADA', 'SIN_DATOS'].includes(f.estado)),
          utilPct: utiles + noUtiles ? Math.round((utiles / (utiles + noUtiles)) * 100) : null },
        porTema: resumen,
        preguntas: filas.map((f) => ({ ...f, fuentes: parse(f.fuentes, []), herramientas: parse(f.herramientas, []) })),
      };
    } catch (error) {
      if (!sinMigracion(error)) throw error;
      return { disponible: false, motivo: error.msg, dias, conteos: null, porTema: [], preguntas: [] };
    }
  }

  async adminTemas() {
    this.cacheTemas.hasta = 0;
    const { temas, filas, disponible } = await this._temas();
    return { disponible, incorporados: A.TEMAS_ALCANCE, filas, temas, fueraEvidente: A.FUERA_EVIDENTE.map((c) => c.categoria) };
  }

  async guardarTema(body, usuario) {
    const t = validarCon(TemaAlcanceSchema, body);
    await this.repo.guardarTema(t, usuario);
    this.cacheTemas.hasta = 0;
    return this.adminTemas();
  }

  /** Prueba del marco sin costo: qué decidirían las reglas. */
  async probarAlcance(body = {}) {
    const pregunta = String(body?.pregunta || '').slice(0, 1000);
    const { temas } = await this._temas();
    const pre = A.prefiltro(pregunta, temas);
    return { pregunta, ...pre, nota: pre.decision === 'dudoso' ? 'Las reglas no deciden: la clasificaría el filtro de alcance (modelo).' : null };
  }
}

module.exports = new AsistenteService();
module.exports.AsistenteService = AsistenteService;
