/*
    Author: German Valencia
    Pattern: PORTTOS Service - Analista de turno (fase 2 modo sombra · fase 3 publicación)
    Description: Cada IA_INTERVALO_MIN (cron 'ia-analista', solo con IA_ENABLED=true), para cada puerto activo
      (IA_PUERTOS; TODOS = cada puerto del maestro con geocerca), de a 2 puertos a la vez:
        1. arma la foto operativa (foto-operativa.service);
        2. decide si vale la pena llamar al modelo: señales nuevas o más graves, o latido (utils/ia/analista.debeAnalizar);
        3. llama al Cerebro con el prompt ACTIVO de TCL_IAPrompts o el incorporado (v1) y la salida forzada;
        4. verifica la evidencia (ids existentes y cifras que salen de lo citado) y aplica la política;
        5. guarda los hallazgos en TCL_IAHallazgos: alertas, tendencias y resumen del turno.
      Fase 3 (IA_MODO_SOMBRA=false): las alertas publicables cuyo tipo está en IA_TIPOS_PUBLICAR (TODOS o una
      lista) quedan PUBLICADO y salen por el motor de alertas (categoría ia_temprana, sala del puerto). Las demás
      siguen PROPUESTO. Siempre se avisa 'ia-hallazgo' a la sala del puerto para refrescar el widget Analista IA.
      Cierre del ciclo: feedback() («útil / no era» → CONFIRMADO / FALSO) y verificarVencidos() (cron
      'ia-verificacion', cada hora: ¿se cumplió lo anunciado al vencer el horizonte?).
      Fase 4: encendido, modo sombra, topes, confianza mínima y tipos a publicar salen de la configuración efectiva
      del puerto (services/ia/config-ia: TCL_IAConfig del panel > .env). IA_ENABLED sigue siendo el interruptor general.
*/
const { configIA } = require('../../config/ia.config');
const FotoOperativa = require('./foto-operativa.service');
const Cerebro = require('./cerebro.service');
const AnalisisRepo = require('../../repositories/ia/analisis-ia.repository');
const SnapshotsRepo = require('../../repositories/ia/snapshots-kpi.repository');
const PuertosIA = require('./puertos-ia.service');
const ConfigIA = require('./config-ia.service');
const { resolverConfig } = require('../../utils/ia/config-efectiva');
const { desdeFila } = require('../../utils/ia/prompts');
const { enLotes } = require('../../utils/ia/lotes');
const { evaluarCumplimiento } = require('../../utils/ia/verificacion');
const { emitir } = require('../../helpers/socket.helper');
const { salaPuerto } = require('../../helpers/salas.helper');
const { validarCon, crearError } = require('../../helpers/errores.helper');
const { PuertoParamsSchema, HallazgosQuerySchema, UsoQuerySchema, HallazgoParamsSchema, FeedbackSchema, validarSalidaAnalista } = require('../../models/ia/analisis-ia.model');
const { PROMPT_ANALISTA, armarSolicitud, verificarEvidencia, aplicarPolitica, debeAnalizar } = require('../../utils/ia/analista');

const TAREA = 'analista_turno';
const PUERTOS_A_LA_VEZ = 2;
const HORA = 3600000;
const RANGO_SEV = { info: 0, atencion: 1, critica: 2 };
const EVENTO_SOCKET = 'ia-hallazgo';
/** El motor de alertas se pide al publicar (require diferido: evita ciclos al cargar los servicios). */
const motorAlertas = () => require('../torre-control/alertas-mapa.service');
/** Notificaciones push de la app móvil (fase 3 móvil); carga perezosa como el motor de alertas. */
const pushMovil = () => require('../movil/push.service');
const { configPush } = require('../../config/push.config');
const tasa = (a, b) => (a + b ? Math.round((a / (a + b)) * 100) : null);
/** Precisión por tipo: % de alertas que se cumplieron (verificación) y % de votos «útil». */
const conTasas = (p) => ({ ...p, precisionPct: tasa(Number(p.seCumplieron) || 0, Number(p.noSeCumplieron) || 0), utilPct: tasa(Number(p.votosUtiles) || 0, Number(p.votosNoEra) || 0) });
const parseEvidencia = (h) => ({ ...h, evidencia: (() => { try { return JSON.parse(h.evidencia || '[]'); } catch { return []; } })() });

class AnalistaService {
  constructor({ config = configIA, fotos = FotoOperativa, cerebro = Cerebro, repo = AnalisisRepo, puertos = PuertosIA,
    snapshots = SnapshotsRepo, alertas = null, avisar = (puerto, datos) => emitir(EVENTO_SOCKET, datos, salaPuerto(puerto, 'mapa')),
    ajustes = null, push = null } = {}) {
    Object.assign(this, { config, fotos, cerebro, repo, puertos, snapshots, avisar });
    // Configuración por puerto: la real (TCL_IAConfig + .env) o, con una config inyectada (pruebas), solo esa
    this.ajustes = ajustes || (config === configIA ? ConfigIA : { efectiva: async (p, t) => resolverConfig([], p, t, config) });
    this.alertas = alertas;          // inyectable en pruebas; si no, el motor de alertas real
    this.push = push;                // inyectable en pruebas; si no, las notificaciones push reales (no hace nada si están apagadas)
    this.ultimaVerificacion = null;
    this.ultimas = new Map();        // puerto → { hash, senales, fecha } de la última foto analizada con éxito
    this.ultimoTurno = null;
  }

  /** Prompt ACTIVO de la base o el incorporado (v1). */
  async _prompt() {
    try {
      return desdeFila(await this.repo.promptActivo(TAREA), PROMPT_ANALISTA);
    } catch (error) {
      if (error?.codigo !== 'MIGRACION_PENDIENTE') throw error;
      return PROMPT_ANALISTA;
    }
  }

  /** Cron 'ia-analista'. */
  async ejecutarTurno(ahora = new Date()) {
    if (!this.config.habilitada) return { insertados: 0, omitido: 'IA_ENABLED=false' };
    const activos = await this.puertos.activos();
    const resultados = (await enLotes(activos, PUERTOS_A_LA_VEZ, (p) => this._analizar(p.clave, { ahora })))
      .map((r, i) => (r.ok ? r.valor : { puerto: activos[i].clave, analizado: false, estado: 'ERROR', motivo: r.error?.msg || r.error?.message }));
    this.ultimoTurno = { fecha: ahora.toISOString(), resultados };
    return { insertados: resultados.reduce((t, r) => t + (r.hallazgos || 0), 0), resultados };
  }

  /** Análisis manual de un puerto (POST /api/analisis-ia/:puerto/analizar): ignora el latido, respeta IA_ENABLED y el presupuesto. */
  async analizarAhora(params, ahora = new Date()) {
    const { puerto } = validarCon(PuertoParamsSchema, params);
    const { clave } = await this.puertos.resolver(puerto);          // 404 si no existe
    if (!(await this.puertos.habilitado(clave))) {
      throw crearError(409, `El puerto ${clave} no está entre los puertos de la IA (IA_PUERTOS)`, 'PUERTO_NO_HABILITADO');
    }
    return this._analizar(clave, { forzar: true, ahora });
  }

  async _analizar(puerto, { forzar = false, ahora = new Date() } = {}) {
    if (!this.config.habilitada) return { puerto, analizado: false, estado: 'OMITIDA_APAGADA', motivo: 'IA_ENABLED=false en el .env' };
    const cfg = await this.ajustes.efectiva(puerto, TAREA);
    if (!cfg.activa) return { puerto, analizado: false, estado: 'OMITIDA_APAGADA', motivo: 'analista apagado para este puerto (panel de IA)' };
    const foto = await this.fotos.foto({ puerto }, ahora);
    const decision = debeAnalizar(this.ultimas.get(puerto), foto, { latidoMin: this.config.latidoMin, forzar, ahora });
    if (!decision.analizar) return { puerto, analizado: false, estado: 'SIN_CAMBIOS', motivo: decision.motivo };

    const prompt = await this._prompt();
    const modelo = prompt.modelo || this.config.modeloAnalista;
    const r = await this.cerebro.ejecutar({
      tarea: TAREA, puerto, prompt, modelo, solicitud: armarSolicitud(foto, prompt), hash: foto.hash,
      validar: validarSalidaAnalista, contexto: { foto }, topes: { llamadas: cfg.topeLlamadasDia, tokens: cfg.topeTokensDia },
    }, ahora);
    if (r.estado !== 'OK') return { puerto, analizado: false, estado: r.estado, motivo: r.motivo, idEjecucion: r.idEjecucion ?? null };
    this.ultimas.set(puerto, { hash: foto.hash, senales: decision.senales, fecha: ahora.getTime() });
    if (r.desdeCache) return { puerto, analizado: true, estado: 'OK', desdeCache: true, hallazgos: 0 };

    const guardados = await this._guardar(puerto, foto, r.valor, r.idEjecucion, ahora, cfg);
    return { puerto, analizado: true, estado: 'OK', motivo: decision.motivo, idEjecucion: r.idEjecucion, costoUsd: r.costoUsd ?? null, ...guardados };
  }

  /** ¿Este tipo de alerta pasó el modo sombra? (IA_TIPOS_PUBLICAR: TODOS o lista de tipos). */
  tipoPublicable(tipo, lista = this.config.tiposPublicar || ['todos']) {
    return lista.includes('todos') || lista.includes(String(tipo || '').toLowerCase());
  }

  /** Verifica, aplica la política, guarda alertas, tendencias y resumen (sin duplicar alertas vigentes) y publica. */
  async _guardar(puerto, foto, salida, idEjecucion, ahora, cfg = null) {
    const ajuste = cfg || await this.ajustes.efectiva(puerto, TAREA);
    const modoSombra = ajuste.modoSombra !== false;
    const verificacion = verificarEvidencia(salida, foto);
    const decisiones = aplicarPolitica(verificacion.alertas, foto, { confianzaMinima: ajuste.confianzaMinima, modoSombra });
    const vigentes = await this.repo.hallazgosVigentes(puerto, ahora.toISOString());
    const clave = (tipo, entidad) => `${tipo}|${String(entidad || '').toLowerCase()}`;
    const porClave = new Map(vigentes.map((h) => [clave(h.tipo, h.entidad), h]));
    const cuenta = { hallazgos: 0, propuestas: 0, publicadas: 0, descartadas: 0, actualizadas: 0, tendencias: 0 };
    const aPublicar = [];

    for (const d of decisiones) {
      const a = d.alerta;
      const previo = d.estado === 'PROPUESTO' ? porClave.get(clave(a.tipo, a.entidad)) : null;
      const publicar = d.estado === 'PROPUESTO' && d.publicable && this.tipoPublicable(a.tipo, ajuste.tiposPublicar);
      // Lo que el usuario ya confirmó o lo ya publicado no vuelve a PROPUESTO por una nueva lectura del modelo
      let estado = publicar ? 'PUBLICADO' : d.estado;
      if (previo && ['PUBLICADO', 'CONFIRMADO'].includes(previo.estado) && d.estado === 'PROPUESTO') estado = previo.estado;
      const motivoTipo = d.estado === 'PROPUESTO' && d.publicable && !publicar ? 'tipo aún en modo sombra (IA_TIPOS_PUBLICAR)' : null;
      const h = {
        idEjecucion, puerto, clase: 'ALERTA', tipo: a.tipo, entidad: a.entidad, severidad: a.severidad, confianza: a.confianza,
        horizonteMinH: a.horizonteHoras[0], horizonteMaxH: a.horizonteHoras[1], titulo: a.titulo, explicacion: a.explicacion,
        accionSugerida: a.accionSugerida, evidencia: a.evidencia, estado,
        vigenteHasta: new Date(ahora.getTime() + Math.max(1, a.horizonteHoras[1]) * HORA).toISOString(),
        resultado: [d.motivo, motivoTipo, d.soloSimulado ? 'solo datos simulados' : null].filter(Boolean).join(' · ') || null,
      };
      let id;
      if (previo) { await this.repo.actualizarHallazgo(previo.id, h); id = previo.id; cuenta.actualizadas++; } else { id = await this.repo.crearHallazgo(h); cuenta.hallazgos++; }
      if (d.estado !== 'PROPUESTO') cuenta.descartadas++; else if (estado === 'PROPUESTO') cuenta.propuestas++; else cuenta.publicadas++;
      // Al motor solo lo nuevo o lo que subió de severidad (el motor además tiene su enfriamiento de 30 min)
      const subio = previo && RANGO_SEV[a.severidad] > RANGO_SEV[previo.severidad];
      if (publicar && (!previo || previo.estado === 'PROPUESTO' || subio)) aPublicar.push({ ...h, id, soloSimulado: d.soloSimulado });
    }

    if (aPublicar.length) {
      try {
        cuenta.alertasMotor = await (this.alertas || motorAlertas()).publicarIA(puerto, aPublicar, ahora);
      } catch (error) {
        console.error(`[ia] no se pudieron publicar las alertas de ${puerto}:`, error?.message);
        cuenta.alertasMotor = 0;
      }
    }
    // Sin PUSH_ENABLED ni siquiera se carga el servicio (no abre la base en procesos o pruebas sin notificaciones)
    if (aPublicar.length && (this.push || configPush.habilitado)) {
      try {
        cuenta.push = (await (this.push || pushMovil()).notificarHallazgos(puerto, aPublicar)).enviados || 0;
      } catch (error) {
        console.error(`[ia] no se pudieron enviar las notificaciones push de ${puerto}:`, error?.message);
        cuenta.push = 0;
      }
    }

    for (const { item: t, ok, motivo } of verificacion.tendencias) {
      await this.repo.crearHallazgo({
        idEjecucion, puerto, clase: 'TENDENCIA', tipo: t.direccion, entidad: t.metrica, titulo: t.lectura, explicacion: t.lectura,
        evidencia: t.evidencia, estado: ok ? 'PROPUESTO' : 'DESCARTADO', vigenteHasta: new Date(ahora.getTime() + 24 * HORA).toISOString(),
        resultado: ok ? (modoSombra ? 'modo sombra' : null) : `EVIDENCIA_INVALIDA: ${motivo}`,
      });
      cuenta.hallazgos++; cuenta.tendencias++;
    }

    if (salida.resumenTurno) {
      await this.repo.crearHallazgo({
        idEjecucion, puerto, clase: 'RESUMEN', tipo: 'resumen_turno', entidad: puerto, titulo: salida.resumenTurno.slice(0, 200),
        explicacion: salida.resumenTurno, evidencia: [], estado: 'PROPUESTO', vigenteHasta: new Date(ahora.getTime() + 8 * HORA).toISOString(),
        resultado: salida.datosInsuficientes?.length ? `datos insuficientes: ${salida.datosInsuficientes.join(', ')}`.slice(0, 400) : (modoSombra ? 'modo sombra' : null),
      });
      cuenta.hallazgos++;
    }
    this.avisar(puerto, { puerto, fecha: ahora.toISOString(), ...cuenta });
    return cuenta;
  }

  // ── Consulta (revisión del modo sombra) ──────────────────────────────────────────────────────────────

  async hallazgos(params, query, ahora = new Date()) {
    const { puerto } = validarCon(PuertoParamsSchema, params);
    const { estado, dias, limite } = validarCon(HallazgosQuerySchema, query);
    const desde = new Date(ahora.getTime() - dias * 24 * HORA).toISOString();
    const { clave } = await this.puertos.resolver(puerto);
    const filas = await this.repo.hallazgos(clave, { estado: estado || null, desdeIso: desde, limite });
    return filas.map(parseEvidencia);
  }

  async resumenSombra(params, query, ahora = new Date()) {
    const { puerto } = validarCon(PuertoParamsSchema, params);
    const { dias } = validarCon(UsoQuerySchema, query);
    const desde = new Date(ahora.getTime() - dias * 24 * HORA).toISOString();
    const { clave } = await this.puertos.resolver(puerto);
    const [hallazgos, uso, precision] = await Promise.all([this.repo.resumenHallazgos(clave, desde), this.repo.uso(desde), this.repo.precision(clave, desde)]);
    return { puerto: clave, dias, hallazgos, precision: precision.map(conTasas), uso: uso.filter((u) => !u.puerto || u.puerto === clave) };
  }

  /** Widget Analista IA: alertas y tendencias vigentes, último resumen y el estado de la capa. */
  async panel(params, ahora = new Date()) {
    const { puerto } = validarCon(PuertoParamsSchema, params);
    const { clave, nombre } = await this.puertos.resolver(puerto);
    const base = { puerto: clave, nombre: nombre || clave, fecha: ahora.toISOString(), estado: await this.estadoCorto(clave) };
    try {
      const { vigentes, resumen } = await this.repo.panel(clave, ahora.toISOString());
      const items = vigentes.map(parseEvidencia);
      return { ...base, alertas: items.filter((h) => h.clase === 'ALERTA'), tendencias: items.filter((h) => h.clase === 'TENDENCIA'), resumen: resumen ? parseEvidencia(resumen) : null };
    } catch (error) {
      if (error?.codigo !== 'MIGRACION_PENDIENTE') throw error;
      return { ...base, alertas: [], tendencias: [], resumen: null, estado: { ...base.estado, disponible: false, motivo: 'Falta la migración 015' } };
    }
  }

  /** «Útil» → CONFIRMADO · «No era» → FALSO. Queda el voto con el usuario y su comentario. */
  async feedback(params, body, usuario) {
    const { id } = validarCon(HallazgoParamsSchema, params);
    const { util, comentario } = validarCon(FeedbackSchema, body);
    const h = await this.repo.obtenerHallazgo(id);
    if (!h) throw crearError(404, `No existe el hallazgo ${id}`, 'HALLAZGO_NO_EXISTE');
    if (h.clase === 'RESUMEN') throw crearError(400, 'El resumen del turno no se califica', 'HALLAZGO_NO_CALIFICABLE');
    await this.repo.registrarFeedback({ idHallazgo: id, usuario: usuario || 'desconocido', util, comentario });
    const estado = util ? 'CONFIRMADO' : 'FALSO';
    if (h.estado !== 'DESCARTADO') await this.repo.cambiarEstado(id, estado);
    const nuevo = h.estado === 'DESCARTADO' ? h.estado : estado;
    this.avisar(h.puerto, { puerto: h.puerto, id, estado: nuevo, feedback: true });
    return { id, estado: nuevo, util };
  }

  /** Cron 'ia-verificacion' (cada hora): al vencer el horizonte, ¿pasó lo anunciado? No llama al modelo. */
  async verificarVencidos(ahora = new Date()) {
    let pendientes;
    try {
      pendientes = await this.repo.porVerificar(ahora.toISOString());
    } catch (error) {
      if (error?.codigo === 'MIGRACION_PENDIENTE') return { verificadas: 0, omitido: 'falta la migración 015' };
      throw error;
    }
    const cuenta = { verificadas: 0, SE_CUMPLIO: 0, NO_SE_CUMPLIO: 0, SIN_CRITERIO: 0 };
    const seriesPorPuerto = new Map();
    for (const h of pendientes) {
      const desde = h.fecha || new Date(ahora.getTime() - 72 * HORA).toISOString();
      const llave = `${h.puerto}|${desde.slice(0, 13)}`;
      if (!seriesPorPuerto.has(llave)) seriesPorPuerto.set(llave, await this.snapshots.serie(h.puerto, desde));
      const r = evaluarCumplimiento(parseEvidencia(h), seriesPorPuerto.get(llave));
      await this.repo.guardarVerificacion(h.id, [`VERIFICACION: ${r.resultado}`, r.detalle, h.resultado].filter(Boolean).join(' · '));
      cuenta.verificadas++; cuenta[r.resultado]++;
    }
    this.ultimaVerificacion = { fecha: ahora.toISOString(), ...cuenta };
    return cuenta;
  }

  /** Lo que el widget necesita saber de la capa: si está prendida, en sombra o con el cortacircuito abierto. */
  async estadoCorto(puerto) {
    const c = this.config;
    const ajuste = await this.ajustes.efectiva(puerto, TAREA);
    const cerebro = this.cerebro.estado?.() || {};
    const turno = this.ultimoTurno?.resultados?.find((r) => r.puerto === puerto) || null;
    return {
      disponible: true, habilitada: !!ajuste.habilitada, modoSombra: ajuste.modoSombra !== false, tiposPublicar: ajuste.tiposPublicar || ['todos'],
      apagadaPor: !c.habilitada ? 'env' : !ajuste.activa ? 'panel' : null,
      cortacircuitoAbierto: !!cerebro.cortacircuito?.abierto, cortacircuitoHasta: cerebro.cortacircuito?.hasta || null, intervaloMin: c.intervaloAnalistaMin,
      ultimoTurno: this.ultimoTurno ? { fecha: this.ultimoTurno.fecha, estado: turno?.estado || null, motivo: turno?.motivo || null } : null,
    };
  }

  async uso(query, ahora = new Date()) {
    const { dias } = validarCon(UsoQuerySchema, query);
    return this.repo.uso(new Date(ahora.getTime() - dias * 24 * HORA).toISOString());
  }

  estado() {
    const c = this.config;
    return {
      habilitada: c.habilitada, proveedor: c.proveedor, modelo: c.modeloAnalista, modoSombra: c.modoSombra !== false, tiposPublicar: c.tiposPublicar || ['todos'], intervaloMin: c.intervaloAnalistaMin,
      latidoMin: c.latidoMin, topes: { llamadasDia: c.topeLlamadasDia, tokensDia: c.topeTokensDia }, confianzaMinima: c.confianzaMinima,
      cerebro: this.cerebro.estado(), ultimoTurno: this.ultimoTurno, ultimaVerificacion: this.ultimaVerificacion,
      ultimasFotosAnalizadas: [...this.ultimas.entries()].map(([puerto, u]) => ({ puerto, fecha: new Date(u.fecha).toISOString(), senales: Object.keys(u.senales).length })),
    };
  }
}

module.exports = new AnalistaService();
module.exports.AnalistaService = AnalistaService;
