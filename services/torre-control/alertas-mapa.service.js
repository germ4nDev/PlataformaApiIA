/*
    Author: German Valencia
    Pattern: PORTTOS Service - Motor de alertas del mapa (fases 1 y 2)
    Description: Orquesta las reglas de utils/reglas-alertas.js, aplica la configuración (TCL_ConfigAlertas),
      el enfriamiento antirruido y emite el evento único 'alerta-mapa' a la sala del puerto
      (puerto:{PUERTO}:mapa). Guarda la bitácora en TCL_AlertasMapa (migración 011); sin la migración
      usa los valores por defecto del catálogo y una bitácora en memoria.
      Entradas:
        - evaluarFlota(): tras cada ciclo del simulador de flota (peaje, geocerca, evento vial cercano).
        - evaluarPuertos(): cron 'alertas-puertos' cada 2 min (ocupación de muelles y fondeo prolongado).
        - evaluarAis(naves, eventos): motor AIS al emitir cambios (nave en zona de faro, atraque, zarpe).
        - limpiar(): cron diario, retención de 30 días.
      Las alertas de camiones llevan simulado:true mientras la flota sea simulada.
*/
const FlotaTerrestreRepository = require('../../repositories/torre-control/flota-terrestre.repository');
const EventosVialesRepository = require('../../repositories/torre-control/eventos-viales.repository');
const AlertasMapaRepository = require('../../repositories/torre-control/alertas-mapa.repository');
const MaritimoVivoService = require('./maritimo-vivo.service');
const FarosService = require('./faro.service');
const { emitir } = require('../../helpers/socket.helper');
const { salaPuerto, normalizarPuerto } = require('../../helpers/salas.helper');
const { puertosEnPunto, listarPuertos, MARGEN } = require('../../helpers/caja-puerto.helper');
const { crearError, validarCon } = require('../../helpers/errores.helper');
const { peajesNacionales } = require('../../helpers/peajes.helper');
const { esquemaReglaAlerta } = require('../../models/torre-control/regla-alerta.model');
const R = require('../../utils/reglas-alertas');

const EVENTO = 'alerta-mapa';
const TAMANO_BITACORA = 50;
const MAXIMO_POR_CICLO = 10;          // por puerto y ciclo, para no inundar la sala
const VIGENCIA_AIS_MIN = 60;
const CONFIG_TTL_MS = 60 * 1000;
const FAROS_TTL_MS = 5 * 60 * 1000;
const RETENCION_DIAS = 30;

class AlertasMapaService {
  constructor() {
    this.posicionesPrevias = new Map();   // placa → [lon, lat]
    this.zonasPrevias = new Map();        // placa → Set(zonas)
    this.zonasNaves = new Map();          // mmsi → id del faro donde está (o null)
    this.estadosOcupacion = new Map();    // puerto|terminal → normal | atencion | critico
    this.enfriamiento = new R.Enfriamiento();
    this.bitacoras = new Map();           // PUERTO → alertas en memoria (más reciente primero)
    this.zonasCebadas = false;
    this.configFilas = [];
    this.configHasta = 0;
    this.persistencia = null;             // null: aún no se sabe · true: hay migración 011 · false: no
    this._peajes = null;
    this._faros = { hasta: 0, lista: [] };
  }

  // ── Configuración ──────────────────────────────────────────────────────────

  async cargarConfig(forzar = false) {
    if (!forzar && Date.now() < this.configHasta) return;
    try {
      this.configFilas = await AlertasMapaRepository.reglas();
      this.persistencia = true;
    } catch (error) {
      if (error.codigo === 'SIN_MIGRACION_011') {
        if (this.persistencia !== false) console.warn('[AlertasMapa] Sin migración 011: valores por defecto y bitácora en memoria.');
        this.persistencia = false;
      } else {
        console.error('[AlertasMapa] No se pudo leer la configuración:', error.message);
      }
      this.configFilas = [];
    }
    this.configHasta = Date.now() + CONFIG_TTL_MS;
    this.enfriamiento.fijarTiempos(Object.fromEntries(Object.keys(R.CATALOGO_REGLAS)
      .map((regla) => [regla, R.resolverConfig(this.configFilas, regla).enfriamientoMs])));
  }

  cfg(regla, puerto = '*') {
    return R.resolverConfig(this.configFilas, regla, puerto);
  }

  // ── Datos de apoyo ─────────────────────────────────────────────────────────

  peajes() {
    return this._peajes || peajesNacionales();   // _peajes: inyección en pruebas
  }

  /** Faros activos con alerta activada y geometría válida (caché 5 min). */
  async faros() {
    if (Date.now() < this._faros.hasta) return this._faros.lista;
    const respuesta = await FarosService.getFaros().catch(() => null);
    const lista = (respuesta?.data || [])
      .filter((f) => f.genera_alerta_toast)
      .map((f) => ({ id: f.id_faro, nombre: f.nombre_faro, geometria: f.geocerca_geo?.features?.[0]?.geometry }))
      .filter((f) => f.geometria && ['Polygon', 'MultiPolygon'].includes(f.geometria.type));
    this._faros = { hasta: Date.now() + FAROS_TTL_MS, lista };
    return lista;
  }

  // ── Evaluación ─────────────────────────────────────────────────────────────

  /** Reglas de flota: peajes, entradas a geocercas y cercanía a eventos viales. */
  async evaluarFlota(ahora = new Date()) {
    await this.cargarConfig();
    const [flota, enZona, eventos] = await Promise.all([
      FlotaTerrestreRepository.obtenerDatosGeograficosFlota(null),
      FlotaTerrestreRepository.detectarEventosGeocerca(),
      EventosVialesRepository.activos(null).catch(() => []),
    ]);
    const posiciones = new Map((flota || []).map((c) => [c.placa, [c.lon, c.lat]]));
    const alertas = [];

    const peaje = this.cfg('peaje');
    if (peaje.activa) {
      alertas.push(...R.alertasPeajes(flota || [], this.posicionesPrevias, this.peajes(), ahora,
        { radio: peaje.umbrales[0], saltoMaximo: peaje.umbrales[1] }));
    }
    const geocercas = R.alertasGeocercas(enZona || [], this.zonasPrevias, posiciones, ahora);
    // Primer ciclo tras arrancar: solo se aprende dónde está cada camión (evita una ráfaga de "ingresó")
    if (this.zonasCebadas && this.cfg('geocerca').activa) alertas.push(...geocercas);
    this.zonasCebadas = true;
    const evento = this.cfg('proximidad_evento');
    if (evento.activa) {
      alertas.push(...R.alertasProximidadEventos(flota || [], eventos || [], ahora, { distancia: evento.umbrales[0] }));
    }

    this.posicionesPrevias = posiciones;
    return this.publicar(alertas, ahora);
  }

  /** Por puerto: ocupación de muelles por terminal y naves fondeadas mucho tiempo. */
  async evaluarPuertos(ahora = new Date()) {
    await this.cargarConfig();
    const alertas = [];
    for (const { clave, centro } of await listarPuertos()) {
      const ocupacion = this.cfg('ocupacion', clave);
      if (ocupacion.activa) {
        const datos = await MaritimoVivoService.ocupacion(clave, { vigenciaMin: VIGENCIA_AIS_MIN }).catch(() => null);
        if (datos) {
          const [atencion, critico, rearme] = ocupacion.umbrales;
          R.alertasOcupacion(clave, datos, this.estadosOcupacion, centro, ahora, { atencion, critico, rearme })
            .forEach((a) => alertas.push({ ...a, puertos: [clave] }));
        }
      }
      const fondeo = this.cfg('fondeo', clave);
      if (fondeo.activa) {
        const resumen = await MaritimoVivoService.resumen(clave, { vigenciaMin: VIGENCIA_AIS_MIN, limiteCola: 20 }).catch(() => null);
        const [atencionHoras, criticoHoras] = fondeo.umbrales;
        R.alertasFondeo(clave, resumen?.fondeo?.cola || [], ahora, { atencionHoras, criticoHoras })
          .forEach((a) => alertas.push({ ...a, puertos: [clave] }));
      }
    }
    return this.publicar(alertas, ahora);
  }

  /** Compatibilidad con la fase 1 (cron 'alertas-ocupacion'). */
  evaluarOcupacion(ahora = new Date()) {
    return this.evaluarPuertos(ahora);
  }

  /**
   * Alertas marítimas desde el motor AIS.
   * @param {Array<{mmsi, nombre, lon, lat, puerto}>} naves  naves con posición nueva en este ciclo
   * @param {Array<object>} eventos  cambios de estado confirmados (registrarCambio del motor AIS)
   */
  async evaluarAis(naves = [], eventos = [], ahora = new Date()) {
    await this.cargarConfig();
    const alertas = [];
    const puertoDe = new Map(naves.map((n) => [String(n.mmsi), n.puerto ? normalizarPuerto(n.puerto) : null]));
    const conPuerto = (a, puerto) => (puerto ? { ...a, puertos: [puerto] } : a);

    if (this.cfg('faro').activa && naves.length) {
      const faros = await this.faros();
      if (faros.length) {
        R.alertasNavesFaros(naves, faros, this.zonasNaves, ahora)
          .forEach((a) => alertas.push(conPuerto(a, puertoDe.get(a.entidad.split('|')[0]))));
      }
    }
    if (eventos.length) {
      const puertoEvento = new Map(eventos.map((e) => [String(e.mmsi), e.id_puerto ? normalizarPuerto(e.id_puerto) : puertoDe.get(String(e.mmsi))]));
      R.alertasCambiosEstado(eventos, ahora)
        .filter((a) => this.cfg(a.categoria).activa)
        .forEach((a) => alertas.push(conPuerto(a, puertoEvento.get(a.entidad))));
    }
    return this.publicar(alertas, ahora);
  }

  // ── Publicación ────────────────────────────────────────────────────────────

  /**
   * Aplica el enfriamiento, resuelve los puertos de cada alerta (los que trae o por su punto), descarta las
   * reglas apagadas para ese puerto, guarda la bitácora y emite a la sala del mapa de cada puerto.
   * @returns {Promise<number>} alertas emitidas
   */
  async publicar(alertas, ahora = new Date()) {
    const porPuerto = new Map();
    for (const alerta of alertas) {
      if (!this.enfriamiento.permitir(alerta, ahora.getTime())) continue;
      const { puertos: fijos, ...limpia } = alerta;
      const puertos = fijos || (limpia.coordenadas ? await puertosEnPunto(limpia.coordenadas[0], limpia.coordenadas[1], MARGEN.TERRESTRE) : []);
      puertos.filter((p) => this.cfg(limpia.categoria, p).activa).forEach((p) => {
        if (!porPuerto.has(p)) porPuerto.set(p, []);
        porPuerto.get(p).push({ ...limpia, puerto: p });
      });
    }

    const emitidas = [];
    const orden = { error: 0, warning: 1, info: 2 };
    porPuerto.forEach((lista, puerto) => {
      lista.sort((a, b) => orden[a.nivel] - orden[b.nivel]).slice(0, MAXIMO_POR_CICLO).forEach((a) => {
        this._guardarEnMemoria(puerto, a);
        emitir(EVENTO, a, salaPuerto(puerto, 'mapa'));
        emitidas.push(a);
      });
    });
    if (emitidas.length && this.persistencia !== false) {
      await AlertasMapaRepository.guardar(emitidas).catch((error) => {
        if (error.codigo === 'SIN_MIGRACION_011') this.persistencia = false;
        else console.error('[AlertasMapa] No se pudo guardar la bitácora:', error.message);
      });
    }
    this.enfriamiento.purgar(ahora.getTime());
    return emitidas.length;
  }

  _guardarEnMemoria(puerto, alerta) {
    const lista = this.bitacoras.get(puerto) || [];
    lista.unshift(alerta);
    this.bitacoras.set(puerto, lista.slice(0, TAMANO_BITACORA));
  }

  /** Últimas alertas del puerto (más reciente primero): de la base si hay migración 011, si no de memoria. */
  async bitacora(puerto, limite = 20) {
    const clave = normalizarPuerto(puerto || '');
    const n = Math.max(1, Math.min(TAMANO_BITACORA, Number(limite) || 20));
    if (!clave) return [];
    if (this.persistencia !== false) {
      try {
        const filas = await AlertasMapaRepository.ultimas(clave, n);
        this.persistencia = true;
        return filas;
      } catch (error) {
        if (error.codigo === 'SIN_MIGRACION_011') this.persistencia = false;
        else console.error('[AlertasMapa] No se pudo leer la bitácora:', error.message);
      }
    }
    return (this.bitacoras.get(clave) || []).slice(0, n);
  }

  /** Retención: borra alertas de más de 30 días (cron diario). */
  async limpiar(ahora = new Date()) {
    if (this.persistencia === false) return 0;
    const antes = new Date(ahora.getTime() - RETENCION_DIAS * 86400000).toISOString();
    await AlertasMapaRepository.purgar(antes).catch((e) => { if (e.codigo === 'SIN_MIGRACION_011') this.persistencia = false; });
    return 0;
  }

  // ── Administración de reglas ───────────────────────────────────────────────

  /** Catálogo (qué significa cada umbral) + filas configuradas + si hay migración. */
  async listarReglas() {
    await this.cargarConfig(true);
    const catalogo = Object.entries(R.CATALOGO_REGLAS).map(([codigo, r]) => ({
      codigo, nombre: r.nombre, niveles: r.niveles, porPuerto: r.porPuerto, enfriamientoMin: r.enfriamientoMin,
      umbrales: r.umbrales.map((u) => ({ etiqueta: u.etiqueta, defecto: u.defecto })),
    }));
    return { persistencia: this.persistencia === true, catalogo, filas: this.configFilas };
  }

  async guardarRegla(datos, usuario = { codigoUsuario: 'SISTEMA_ADMIN' }) {
    const v = validarCon(esquemaReglaAlerta, datos);
    const cat = R.CATALOGO_REGLAS[v.codigo_regla];
    if (v.id_puerto !== '*' && !cat.porPuerto) {
      throw crearError(400, `La regla ${cat.nombre} solo se configura globalmente`, 'VALIDACION');
    }
    const u = [v.umbral_1, v.umbral_2, v.umbral_3];
    if (v.codigo_regla === 'ocupacion' && u.every((x) => x != null) && !(u[2] < u[0] && u[0] <= u[1] && u[1] <= 100)) {
      throw crearError(400, 'Ocupación: debe cumplirse rearme < amarillo ≤ rojo ≤ 100', 'VALIDACION');
    }
    if (v.codigo_regla === 'fondeo' && u[0] != null && u[1] != null && !(u[0] <= u[1])) {
      throw crearError(400, 'Fondeo: el umbral amarillo debe ser menor o igual que el rojo', 'VALIDACION');
    }
    await this.cargarConfig();
    if (this.persistencia === false) throw crearError(503, 'Falta aplicar la migración 011_alertas_mapa.sql', 'MIGRACION_PENDIENTE');
    await AlertasMapaRepository.guardarRegla({
      ...v, descripcion: cat.nombre, fecha_modificacion: new Date().toISOString(), usuario_modificacion: usuario.codigoUsuario,
    });
    await this.cargarConfig(true);
    return this.listarReglas();
  }

  async eliminarRegla(codigo, puerto) {
    if (!puerto || puerto === '*') throw crearError(400, 'La configuración global no se elimina; desactive la regla', 'VALIDACION');
    await AlertasMapaRepository.eliminarRegla(codigo, normalizarPuerto(puerto));
    await this.cargarConfig(true);
    return this.listarReglas();
  }
}

module.exports = new AlertasMapaService();
module.exports.AlertasMapaService = AlertasMapaService;
