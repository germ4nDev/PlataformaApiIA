/*
    Author: German Valencia
    Pattern: PORTTOS Service - Cierre de turno y resumen diario por puerto (capa de IA, fase 4)
    Description: Cron 'ia-resumenes' (minuto 5 de cada hora). Cuando acaba de cerrar un turno (IA_TURNOS, hora de
      Colombia) arma el cierre de turno de cada puerto activo; con el primer turno del día, también el resumen del
      día operativo. Un periodo no se repite (TCL_IAHallazgos: clase RESUMEN, entidad = clave del periodo).
      Contexto: tendencias destacadas (tendencias-ia), alertas del periodo con su estado y verificación, y contexto
      externo (noticias recientes del puerto y TRM). Con IA_ENABLED y la tarea resumen_turno encendida para el
      puerto lo redacta el modelo (prompt ACTIVO de TCL_IAPrompts o el incorporado; evidencia verificada). Si no,
      o si el modelo falla o no hay presupuesto, guarda el resumen automático (mismo formato, sin costo).
      - cerrarPeriodos(ahora)              cron
      - generar(puerto, periodo, ahora)    arma, guarda y avisa por 'ia-hallazgo'
      - resumenes(params, query)           GET /api/analisis-ia/:puerto/resumenes
      - generarAhora(params, body)         POST /api/analisis-ia/:puerto/resumenes (el último periodo cerrado)
*/
const crypto = require('crypto');
const { configIA } = require('../../config/ia.config');
const Cerebro = require('./cerebro.service');
const ConfigIA = require('./config-ia.service');
const Tendencias = require('./tendencias-ia.service');
const PuertosIA = require('./puertos-ia.service');
const AnalisisRepo = require('../../repositories/ia/analisis-ia.repository');
const ResumenesRepo = require('../../repositories/ia/resumenes-ia.repository');
const NoticiasRepo = require('../../repositories/torre-control/noticias.repository');
const { enLotes } = require('../../utils/ia/lotes');
const { resolverConfig } = require('../../utils/ia/config-efectiva');
const { desdeFila } = require('../../utils/ia/prompts');
const R = require('../../utils/ia/resumen');
const { emitir } = require('../../helpers/socket.helper');
const { salaPuerto } = require('../../helpers/salas.helper');
const { validarCon } = require('../../helpers/errores.helper');
const { PuertoParamsSchema, ResumenesQuerySchema, GenerarResumenSchema, validarSalidaResumen } = require('../../models/ia/analisis-ia.model');

const TAREA = 'resumen_turno';
const HORA = 3600000;
const PUERTOS_A_LA_VEZ = 2;
const parseJson = (t, defecto) => { try { return t ? JSON.parse(t) : defecto; } catch { return defecto; } };

/** Noticias recientes del puerto (o generales) y TRM. Si falta la 013 o falla, contexto vacío. */
async function contextoExterno(puerto, ahora) {
  const desde = new Date(ahora.getTime() - 24 * HORA).toISOString();
  const [noticias, trm] = await Promise.all([
    NoticiasRepo.recientes(desde, 60).catch(() => []),
    NoticiasRepo.indicador('TRM', 2).catch(() => []),
  ]);
  const propias = noticias.filter((n) => !n.id_puerto || String(n.id_puerto).toUpperCase() === puerto)
    .sort((a, b) => (Number(b.relevancia) || 0) - (Number(a.relevancia) || 0));
  return { noticias: propias.slice(0, 5), trm };
}

class ResumenesIAService {
  constructor({ config = configIA, cerebro = Cerebro, repo = ResumenesRepo, analisis = AnalisisRepo, tendencias = Tendencias,
    puertos = PuertosIA, ajustes = null, externo = contextoExterno, avisar = (puerto, datos) => emitir('ia-hallazgo', datos, salaPuerto(puerto, 'mapa')) } = {}) {
    Object.assign(this, { config, cerebro, repo, analisis, tendencias, puertos, externo, avisar });
    this.ajustes = ajustes || (config === configIA ? ConfigIA : { efectiva: async (p, t) => resolverConfig([], p, t, config) });
    this.ultimaCorrida = null;
  }

  async _prompt() {
    try {
      return desdeFila(await this.analisis.promptActivo(TAREA), R.PROMPT_RESUMEN);
    } catch (error) {
      if (error?.codigo !== 'MIGRACION_PENDIENTE') throw error;
      return R.PROMPT_RESUMEN;
    }
  }

  /** Cron 'ia-resumenes'. */
  async cerrarPeriodos(ahora = new Date()) {
    if (!this.config.resumenesHabilitados) return { generados: 0, omitido: 'IA_RESUMENES_ENABLED=false' };
    const periodos = R.periodosPorCerrar(ahora, this.config.turnos);
    if (!periodos.length) return { generados: 0, omitido: 'no cerró ningún turno en la última hora' };
    const activos = await this.puertos.activos();
    const trabajos = activos.flatMap((p) => periodos.map((periodo) => ({ puerto: p.clave, periodo })));
    const resultados = (await enLotes(trabajos, PUERTOS_A_LA_VEZ, async ({ puerto, periodo }) => {
      if (await this.repo.existeResumen(puerto, periodo.tipo, periodo.clave)) return { puerto, tipo: periodo.tipo, omitido: 'ya existe' };
      return this.generar(puerto, periodo, ahora);
    })).map((r, i) => (r.ok ? r.valor : { puerto: trabajos[i].puerto, tipo: trabajos[i].periodo.tipo, error: r.error?.msg || r.error?.message }));
    this.ultimaCorrida = { fecha: ahora.toISOString(), resultados };
    return { generados: resultados.filter((r) => r.id || r.guardado === false).length, resultados };
  }

  /** Arma el resumen de un periodo, lo guarda y avisa. */
  async generar(puerto, periodo, ahora = new Date(), { manual = false } = {}) {
    const cfg = await this.ajustes.efectiva(puerto, TAREA);
    const [tend, alertas, externo] = await Promise.all([
      this.tendencias.paraPuerto(puerto, ahora).catch(() => ({ destacadas: [] })),
      this.repo.alertasDelPeriodo(puerto, periodo.desde, periodo.hasta).catch(() => []),
      this.externo(puerto, ahora).catch(() => ({})),
    ]);
    const contexto = R.armarContexto({ puerto, periodo, tendencias: tend.destacadas || [], hallazgos: alertas, externo });
    const borrador = R.resumenAutomatico(contexto);

    let salida = borrador;
    let origen = 'automatico';
    let motivo = null;
    let idEjecucion = null;
    let modelo = null;
    let quitadas = [];
    if (!this.config.habilitada) motivo = 'IA_ENABLED=false';
    else if (!cfg.activa) motivo = 'resúmenes con IA apagados para este puerto';
    else {
      const prompt = await this._prompt();
      modelo = prompt.modelo || this.config.modeloResumen;
      const { indice, ...hechos } = contexto;
      const hash = crypto.createHash('sha256').update(JSON.stringify(hechos)).digest('hex').slice(0, 32);
      const r = await this.cerebro.ejecutar({
        tarea: TAREA, puerto, prompt, modelo, solicitud: R.armarSolicitudResumen(contexto, prompt), hash,
        validar: validarSalidaResumen, contexto: { borrador }, topes: { llamadas: cfg.topeLlamadasDia, tokens: cfg.topeTokensDia },
      }, ahora);
      idEjecucion = r.idEjecucion ?? null;
      if (r.estado === 'OK') {
        ({ salida, quitadas } = R.verificarResumen(r.valor, contexto));
        origen = 'modelo';
      } else {
        motivo = `${r.estado}${r.motivo ? `: ${r.motivo}` : ''}`.slice(0, 200);
      }
    }

    // Las tendencias del resumen van con sus cifras (para el widget, sin otra consulta)
    const porId = new Map(contexto.tendencias.map((t) => [t.id, t]));
    const contenido = {
      ...salida, tendencias: salida.tendencias.map((t) => ({ ...porId.get(t.id), ...t })),
      origen, modelo: origen === 'modelo' ? modelo : null, periodo, conteos: contexto.conteos,
      externo: { noticias: contexto.noticias.map((n) => ({ titulo: n.tituloExterna, medio: n.medio })), trm: contexto.trm },
      quitadas, manual,
    };
    const fila = {
      idEjecucion, puerto, tipo: periodo.tipo, entidad: periodo.clave, titulo: salida.titular, explicacion: R.textoPlano(salida),
      evidencia: salida.evidencia, estado: cfg.modoSombra ? 'PROPUESTO' : 'PUBLICADO',
      vigenteHasta: new Date(Date.parse(periodo.hasta) + (periodo.tipo === 'resumen_diario' ? 24 : 8) * HORA).toISOString(),
      resultado: [`origen: ${origen}`, motivo, quitadas.length ? `evidencia quitada: ${quitadas.join(', ')}` : null, manual ? 'manual' : null]
        .filter(Boolean).join(' · '),
      contenido,
    };
    let id = null;
    let guardado = true;
    try {
      id = await this.repo.guardarResumen(fila);
    } catch (error) {
      if (error?.codigo !== 'MIGRACION_PENDIENTE') throw error;
      guardado = false;
    }
    this.avisar(puerto, { puerto, resumen: periodo.tipo, id, fecha: ahora.toISOString() });
    return { puerto, tipo: periodo.tipo, clave: periodo.clave, id, guardado, origen, motivo, resumen: { ...fila, id, contenido } };
  }

  async resumenes(params, query = {}, ahora = new Date()) {
    const { puerto } = validarCon(PuertoParamsSchema, params);
    const { tipo, dias, limite } = validarCon(ResumenesQuerySchema, query);
    const { clave } = await this.puertos.resolver(puerto);
    try {
      const filas = await this.repo.resumenes(clave, {
        tipos: tipo ? [tipo] : ResumenesRepo.TIPOS_RESUMEN || ['cierre_turno', 'resumen_diario'],
        desdeIso: new Date(ahora.getTime() - dias * 24 * HORA).toISOString(), limite,
      });
      return { puerto: clave, disponible: true, resumenes: filas.map((f) => ({ ...f, evidencia: parseJson(f.evidencia, []), contenido: parseJson(f.contenido, {}) })) };
    } catch (error) {
      if (error?.codigo !== 'MIGRACION_PENDIENTE') throw error;
      return { puerto: clave, disponible: false, motivo: error.msg, resumenes: [] };
    }
  }

  /** Manual: rehace el último periodo cerrado (queda como el más reciente; el anterior no se borra). */
  async generarAhora(params, body = {}, ahora = new Date()) {
    const { puerto } = validarCon(PuertoParamsSchema, params);
    const { tipo } = validarCon(GenerarResumenSchema, body);
    const { clave } = await this.puertos.resolver(puerto);
    const periodo = tipo === 'resumen_diario' ? R.periodoDiario(ahora, this.config.turnos) : R.periodoTurno(ahora, this.config.turnos);
    const r = await this.generar(clave, periodo, ahora, { manual: true });
    return { ...r, resumen: { ...r.resumen } };
  }

  estado() {
    return { habilitados: this.config.resumenesHabilitados, turnos: this.config.turnos, modelo: this.config.modeloResumen, ultimaCorrida: this.ultimaCorrida };
  }
}

module.exports = new ResumenesIAService();
module.exports.ResumenesIAService = ResumenesIAService;
