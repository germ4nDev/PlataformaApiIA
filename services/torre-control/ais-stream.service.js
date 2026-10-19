/*
    Author: German Valencia
    Pattern: PORTTOS Service
    Descripción: Motor de ingesta AIS en tiempo real (AISStream) aislado del resto del sistema.

    Principios:
      - El WebSocket NUNCA espera a la base de datos: cada trama solo actualiza un buffer en memoria.
      - El buffer guarda la ÚLTIMA posición por MMSI y se vacía a SQL Server por lotes (un MERGE por lote).
      - Nunca se suscribe al planeta completo: sin geocercas válidas, el motor no arranca.
      - El envío a los clientes se agrupa: cada nave se emite como máximo una vez por ciclo.

    Estado de la nave (helpers/estado-nave.helper.js):
      - Se infiere con NavigationalStatus + velocidad + zona (muelle / terminal / puerto).
      - Histéresis: un cambio solo se confirma si se sostiene AIS_CONFIRMACION_MS (evita parpadeos
        por ruido de GPS o una trama aislada). VARADO, SIN GOBIERNO y EMERGENCIA se confirman de inmediato.
      - Cada cambio confirmado se emite como 'nave-cambio-estado' y, si existe la tabla
        TCL_EventosEstadoNave (migración 005), queda en bitácora para los KPIs de fondeo y estadía.

    Variables de entorno:
      AIS_ENABLED=true            Enciende el motor (apagado por defecto).
      AIS_API_KEY=...             Clave de AISStream.
      AIS_SOLO_AVISADAS=true      Filtra por MMSI de naves avisadas (máx. 50). Por defecto: todas las naves dentro de las geocercas.
      AIS_FLUSH_MS=10000          Cada cuánto se persiste el buffer en BD.
      AIS_EMIT_MS=2000            Cada cuánto se emiten los cambios por socket.
      AIS_CONFIRMACION_MS=120000  Cuánto debe sostenerse un estado nuevo antes de confirmarlo.
      AIS_ZONAS_MS=3600000        Cada cuánto se recargan las geocercas de muelles, terminales y puertos.
      AIS_PUERTOS_DEFECTO=BUENAVENTURA  Puertos a rastrear cuando nadie tiene el mapa abierto (separados por coma).
                                        Vacío = todos los puertos con geocerca.

    Puerto seleccionado (filtro del tablero):
      - El mapa se une a la sala puerto:{PUERTO}:maritimo con el puerto elegido en el filtro.
      - La suscripción a AISStream cubre solo los puertos que alguien está mirando; si no hay nadie,
        usa AIS_PUERTOS_DEFECTO (o todos). Cuando el conjunto cambia, se reconecta con las cajas nuevas.
      - Cada nave se emite solo a la sala de su puerto, y quien entra a la sala recibe la foto actual.
*/
const AisStreamAdapter = require('../../adapters/aisstream.adapter');
const turf = require('@turf/turf');
const wellknown = require('wellknown');
const MaritimoRepository = require('../../repositories/torre-control/maritimo.repository');
const { normalizarPuerto } = require('../../helpers/salas.helper');
const {
  ESTADOS_NAVE, ESTADOS_CRITICOS, ESTADOS_VALIDOS,
  inferirEstadoNave, normalizarNavStatus, textoNavStatus,
} = require('../../helpers/estado-nave.helper');

const MAX_MMSI_POR_SUSCRIPCION = 50;  // Límite de AISStream para FiltersShipMMSI
const MAX_AREA_GEOCERCA_GRADOS2 = 25; // Protección contra cajas gigantes (≈ 5° x 5°)
const TAMANO_LOTE_BD = 50;
const TAMANO_LOTE_EVENTOS = 200;
const MAX_EVENTOS_EN_COLA = 5000;
const VIGENCIA_EN_MEMORIA_MS = 30 * 60 * 1000;
const PATRON_SALA_MARITIMA = /^puerto:([A-Z0-9_]+):maritimo$/;
const ESPERA_RECALCULO_MS = 3000; // agrupa varios cambios de filtro seguidos en una sola reconexión

const entero = (valor, defecto) => {
  const n = parseInt(valor, 10);
  return Number.isFinite(n) && n > 0 ? n : defecto;
};

/** Convierte una fila { wkt, ... } en una zona con polígono GeoJSON y bbox para descarte rápido. */
const construirZona = (fila) => {
  try {
    const geometria = fila?.wkt ? wellknown.parse(fila.wkt) : null;
    if (!geometria) return null;

    let poligono = null;
    if (geometria.type === 'Polygon' || geometria.type === 'MultiPolygon') {
      poligono = geometria;
    } else if (geometria.type === 'GeometryCollection') {
      // MakeValid() puede devolver colecciones: nos quedamos con las partes poligonales
      const partes = (geometria.geometries || []).flatMap((g) => {
        if (g.type === 'Polygon') return [g.coordinates];
        if (g.type === 'MultiPolygon') return g.coordinates;
        return [];
      });
      if (partes.length) poligono = { type: 'MultiPolygon', coordinates: partes };
    }
    if (!poligono) return null;

    const feature = turf.feature(poligono);
    return {
      id_puerto: fila.id_puerto || null,
      id_terminal: fila.id_terminal || null,
      codigo_muelle: fila.codigo_muelle || null,
      nombre: fila.nombre || null,
      bbox: turf.bbox(feature),
      feature,
    };
  } catch (_) {
    return null;
  }
};

class AISStreamService {
  constructor() {
    this.ws = null;
    this.io = null;
    this.activo = false;

    this.geocercas = [];        // cajas suscritas en AISStream (solo puertos activos)
    this.puertosRadar = [];     // todos los puertos con geocerca válida: { id_puerto, nombre, claves, salas, caja }
    this.puertosActivos = [];
    this.modoRadar = 'todos';   // 'seleccion' | 'defecto' | 'todos'
    this.mmsiFiltro = [];
    this.zonas = { muelles: [], terminales: [], puertos: [] };
    this.capacidades = { columnasExtendidas: false, tablaEventos: false };
    this.confirmacionMs = entero(process.env.AIS_CONFIRMACION_MS, 120000);

    // mmsi -> { mmsi, lat, lon, velocidad, rumbo, navStatus, zona, estado, estadoDesde, candidato, candidatoDesde,
    //           nombre_motonave, destino, t, pendienteBD, pendienteSocket }
    this.naves = new Map();
    // Estado leído de BD al arrancar: mmsi -> { estado, desde }
    this.estadosSembrados = new Map();

    this.eventosPorPersistir = [];
    this.eventosPorEmitir = [];

    this.temporizadorFlush = null;
    this.temporizadorEmision = null;
    this.temporizadorZonas = null;
    this.temporizadorRecalculo = null;
    this.reconectarYa = false;
    this.flushEnCurso = false;

    this.intentosReconexion = 0;
    this.retrasoBase = 5000;
    this.retrasoMaximo = 60000;

    this.metricas = { tramas: 0, descartadas: 0, persistidas: 0, erroresBD: 0, cambiosEstado: 0 };
  }

  // ------------------------------------------------------------------
  // Ciclo de vida
  // ------------------------------------------------------------------
  async iniciarConexion(io) {
    if (this.activo) return;
    if (!process.env.AIS_API_KEY) {
      console.warn('⚠️ [AIS] No se encontró AIS_API_KEY. Motor no iniciado.');
      return;
    }

    this.io = io;
    await this.cargarParametrosRadar();

    if (this.geocercas.length === 0) {
      console.warn('⚠️ [AIS] No hay geocercas válidas en TCL_MaestroPuertos. Motor no iniciado para evitar suscribirse al planeta completo.');
      return;
    }

    await this.cargarZonas();
    this.capacidades = await MaritimoRepository.getCapacidadesEstadoAIS();
    await this.sembrarEstados();
    if (!this.capacidades.columnasExtendidas || !this.capacidades.tablaEventos) {
      console.log('ℹ️ [AIS] Migración 005 no aplicada: el estado se calcula y emite, pero sin zona ni bitácora en BD.');
    }

    this.activo = true;
    this.escucharSalas();
    this.temporizadorFlush = setInterval(() => this.persistirBuffer(), entero(process.env.AIS_FLUSH_MS, 10000));
    this.temporizadorEmision = setInterval(() => this.emitirCambios(), entero(process.env.AIS_EMIT_MS, 2000));
    this.temporizadorZonas = setInterval(() => this.cargarZonas(), entero(process.env.AIS_ZONAS_MS, 3600000));
    this.conectarWebSocket();
  }

  async detener() {
    this.activo = false;
    clearInterval(this.temporizadorFlush);
    clearInterval(this.temporizadorEmision);
    clearInterval(this.temporizadorZonas);
    clearTimeout(this.temporizadorRecalculo);
    this.ws?.cerrar();
    await this.persistirBuffer();
    console.log('🛑 [AIS] Motor detenido.');
  }

  estado() {
    return {
      activo: this.activo,
      conectado: Boolean(this.ws?.abierto()),
      geocercas: this.geocercas.length,
      modoRadar: this.modoRadar,
      puertosActivos: this.puertosActivos.map((p) => p.id_puerto || p.nombre),
      zonas: {
        muelles: this.zonas.muelles.length,
        terminales: this.zonas.terminales.length,
        puertos: this.zonas.puertos.length,
      },
      capacidades: this.capacidades,
      mmsiFiltro: this.mmsiFiltro.length,
      navesEnMemoria: this.naves.size,
      eventosEnCola: this.eventosPorPersistir.length,
      ...this.metricas,
    };
  }

  /**
   * Foto actual por puerto: cuántas naves hay en cada estado y cuánto llevan fondeadas.
   * Base para el KPI de congestión (tiempo en fondeo) sin ir a la BD.
   */
  resumenPorPuerto(ahora = Date.now()) {
    const resumen = {};
    for (const nave of this.naves.values()) {
      if (!nave.estado || nave.lat == null) continue;
      const puerto = nave.zona?.id_puerto || 'FUERA_DE_PUERTO';
      const r = resumen[puerto] || (resumen[puerto] = { total: 0, estados: {}, fondeoPromedioMin: 0, fondeoMaximoMin: 0 });
      r.total++;
      r.estados[nave.estado] = (r.estados[nave.estado] || 0) + 1;
      if (nave.estado === ESTADOS_NAVE.FONDEADO && nave.estadoDesde) {
        const min = (ahora - nave.estadoDesde) / 60000;
        r._sumaFondeo = (r._sumaFondeo || 0) + min;
        r.fondeoMaximoMin = Math.max(r.fondeoMaximoMin, Math.round(min));
      }
    }
    for (const r of Object.values(resumen)) {
      const fondeadas = r.estados[ESTADOS_NAVE.FONDEADO] || 0;
      r.fondeoPromedioMin = fondeadas ? Math.round((r._sumaFondeo || 0) / fondeadas) : 0;
      delete r._sumaFondeo;
    }
    return resumen;
  }

  // ------------------------------------------------------------------
  // Parámetros de suscripción
  // ------------------------------------------------------------------
  async cargarParametrosRadar() {
    try {
      const puertos = await MaritimoRepository.getPuertosParaMapa();
      this.puertosRadar = puertos
        .map((p) => ({
          id_puerto: p.id_puerto || null,
          nombre: p.nombre,
          sur: parseFloat(p.bbox_lat_sur), oeste: parseFloat(p.bbox_lon_oeste),
          norte: parseFloat(p.bbox_lat_norte), este: parseFloat(p.bbox_lon_este),
        }))
        .filter((g) => {
          const valida = [g.sur, g.oeste, g.norte, g.este].every(Number.isFinite)
            && g.sur >= -90 && g.norte <= 90 && g.oeste >= -180 && g.este <= 180
            && g.sur < g.norte && g.oeste < g.este;
          const area = (g.norte - g.sur) * (g.este - g.oeste);
          if (!valida || area > MAX_AREA_GEOCERCA_GRADOS2) {
            console.warn(`⚠️ [AIS] Geocerca descartada (${g.nombre}): inválida o demasiado grande.`);
            return false;
          }
          return true;
        })
        .map((g) => {
          // El filtro del tablero puede mandar el id o el nombre ("BUENAVENTURA", "Santa Marta"): aceptamos ambos
          const claves = [...new Set([normalizarPuerto(g.id_puerto), normalizarPuerto(g.nombre)].filter(Boolean))];
          return {
            id_puerto: g.id_puerto,
            nombre: g.nombre,
            claves,
            salas: claves.map((c) => `puerto:${c}:maritimo`),
            limites: g,
            caja: [[g.sur, g.oeste], [g.norte, g.este]],
          };
        });
    } catch (error) {
      console.error('❌ [AIS] Error cargando geocercas:', error.message);
      this.puertosRadar = [];
    }

    this.calcularPuertosActivos();
    await this.cargarFiltroMmsi();
  }

  /** Claves de puerto que alguien está mirando ahora (salas puerto:{PUERTO}:maritimo con al menos un cliente). */
  puertosObservados() {
    const claves = new Set();
    const salas = typeof this.io?.of === 'function' ? this.io.of('/').adapter?.rooms : null;
    if (!salas) return claves;
    for (const [sala, sockets] of salas) {
      const m = PATRON_SALA_MARITIMA.exec(sala);
      if (m && sockets.size > 0) claves.add(m[1]);
    }
    return claves;
  }

  /** Decide qué puertos rastrear: los seleccionados → AIS_PUERTOS_DEFECTO → todos. Devuelve true si cambiaron las cajas. */
  calcularPuertosActivos() {
    const firmaAnterior = JSON.stringify(this.geocercas);
    const observados = this.puertosObservados();
    let activos = this.puertosRadar.filter((p) => p.claves.some((c) => observados.has(c)));
    let modo = 'seleccion';

    if (activos.length === 0) {
      const defecto = String(process.env.AIS_PUERTOS_DEFECTO || '').split(',').map(normalizarPuerto).filter(Boolean);
      activos = defecto.length ? this.puertosRadar.filter((p) => p.claves.some((c) => defecto.includes(c))) : [];
      modo = 'defecto';
      if (defecto.length && activos.length === 0) {
        console.warn(`⚠️ [AIS] AIS_PUERTOS_DEFECTO=${process.env.AIS_PUERTOS_DEFECTO} no coincide con ningún puerto con geocerca. Se rastrean todos.`);
      }
      if (activos.length === 0) {
        activos = this.puertosRadar;
        modo = 'todos';
      }
    }

    this.puertosActivos = activos;
    this.modoRadar = modo;
    this.geocercas = activos.map((p) => p.caja);
    return JSON.stringify(this.geocercas) !== firmaAnterior;
  }

  /** Reacciona cuando un puerto gana su primer observador o pierde el último, y envía la foto a quien entra. */
  escucharSalas() {
    const adapter = typeof this.io?.of === 'function' ? this.io.of('/').adapter : null;
    if (!adapter || this.escuchandoSalas) return;
    this.escuchandoSalas = true;

    const alCambiar = (sala) => { if (PATRON_SALA_MARITIMA.test(sala)) this.programarRecalculo(); };
    adapter.on('create-room', alCambiar);
    adapter.on('delete-room', alCambiar);
    adapter.on('join-room', (sala, socketId) => {
      if (PATRON_SALA_MARITIMA.test(sala)) this.enviarFoto(sala, socketId);
    });
  }

  programarRecalculo() {
    clearTimeout(this.temporizadorRecalculo);
    this.temporizadorRecalculo = setTimeout(() => {
      if (!this.activo || !this.calcularPuertosActivos()) return;
      const nombres = this.puertosActivos.map((p) => p.nombre).join(', ');
      console.log(`🎯 [AIS] Radar ajustado (${this.modoRadar}): ${nombres}.`);
      this.reiniciarSuscripcion();
    }, ESPERA_RECALCULO_MS);
  }

  /** Reconecta de inmediato para aplicar las cajas nuevas (más seguro que actualizar la suscripción en caliente). */
  reiniciarSuscripcion() {
    if (!this.ws || this.ws.cerrado()) return;
    this.reconectarYa = true;
    this.ws.cerrar();
  }

  /** Puerto al que pertenece la nave: el de su zona; si no, el puerto cuya caja la contiene. */
  puertoDeNave(lon, lat, zona) {
    if (zona?.id_puerto) {
      const clave = normalizarPuerto(zona.id_puerto);
      const porZona = this.puertosRadar.find((p) => p.claves.includes(clave));
      if (porZona) return porZona;
    }
    return this.puertosRadar.find((p) => lat >= p.limites.sur && lat <= p.limites.norte
      && lon >= p.limites.oeste && lon <= p.limites.este) || null;
  }

  /** Quien acaba de entrar a la sala recibe de una vez las naves que ya están en memoria para ese puerto. */
  enviarFoto(sala, socketId) {
    if (!this.io) return;
    const clave = PATRON_SALA_MARITIMA.exec(sala)?.[1];
    const puerto = this.puertosRadar.find((p) => p.claves.includes(clave));
    if (!puerto) return;
    const ahora = Date.now();
    for (const nave of this.naves.values()) {
      if (nave.puerto === puerto && nave.lat != null) {
        this.io.to(socketId).emit('radar-actualizado', this.construirFeature(nave, ahora));
      }
    }
  }

  async cargarFiltroMmsi() {
    this.mmsiFiltro = [];
    if (process.env.AIS_SOLO_AVISADAS !== 'true') return;

    const mmsi = await MaritimoRepository.getMmsiParaRastreo();
    if (mmsi.length > MAX_MMSI_POR_SUSCRIPCION) {
      console.warn(`⚠️ [AIS] ${mmsi.length} MMSI avisados superan el límite de ${MAX_MMSI_POR_SUSCRIPCION}. Se rastrean todas las naves dentro de las geocercas.`);
      return;
    }
    this.mmsiFiltro = mmsi;
  }

  /** Lo invoca el scraper de SITMAR cuando cambian las naves avisadas. */
  async recargarListaBlanca() {
    await this.cargarFiltroMmsi();
    if (this.ws?.abierto()) this.enviarSuscripcion();
  }

  /** Geocercas de muelles, terminales y puertos para ubicar cada nave. Si falla, conserva las anteriores. */
  async cargarZonas() {
    try {
      const filas = await MaritimoRepository.getZonasOperativasAIS();
      const zonas = {
        muelles: (filas.muelles || []).map(construirZona).filter(Boolean),
        terminales: (filas.terminales || []).map(construirZona).filter(Boolean),
        puertos: (filas.puertos || []).map(construirZona).filter(Boolean),
      };
      const total = zonas.muelles.length + zonas.terminales.length + zonas.puertos.length;
      if (total === 0 && this.zonas.puertos.length > 0) return; // no borrar zonas buenas por un fallo de BD
      this.zonas = zonas;
      console.log(`🗺️ [AIS] Zonas: ${zonas.muelles.length} muelles · ${zonas.terminales.length} terminales · ${zonas.puertos.length} puertos.`);
    } catch (error) {
      console.error('❌ [AIS] Error cargando zonas operativas:', error.message);
    }
  }

  /** Arranca con el último estado guardado para no perder "desde cuándo" está fondeada cada nave. */
  async sembrarEstados() {
    const filas = await MaritimoRepository.getEstadosAISVigentes(this.capacidades.columnasExtendidas);
    this.estadosSembrados.clear();
    for (const f of filas) {
      if (!ESTADOS_VALIDOS.has(f.estado_inferido)) continue; // valores viejos (EN MOVIMIENTO, EN TRÁNSITO...)
      const desde = f.fecha_cambio_estado ? new Date(f.fecha_cambio_estado).getTime() : null;
      this.estadosSembrados.set(String(f.mmsi), { estado: f.estado_inferido, desde: Number.isFinite(desde) ? desde : null });
    }
  }

  ubicarZona(lon, lat) {
    const punto = [lon, lat];
    const dentro = (z) => lon >= z.bbox[0] && lat >= z.bbox[1] && lon <= z.bbox[2] && lat <= z.bbox[3]
      && turf.booleanPointInPolygon(punto, z.feature);

    const zona = this.zonas.muelles.find(dentro)
      || this.zonas.terminales.find(dentro)
      || this.zonas.puertos.find(dentro);
    if (!zona) return null;

    let idPuerto = zona.id_puerto;
    if (!idPuerto) idPuerto = this.zonas.puertos.find(dentro)?.id_puerto || null;
    return {
      id_puerto: idPuerto,
      id_terminal: zona.id_terminal,
      codigo_muelle: zona.codigo_muelle,
      nombre_zona: zona.nombre,
    };
  }

  enviarSuscripcion() {
    this.ws.suscribir(this.geocercas, this.mmsiFiltro);
    console.log(`📡 [AIS] Suscrito: ${this.geocercas.length} geocercas · ${this.mmsiFiltro.length || 'todas las'} naves.`);
  }

  // ------------------------------------------------------------------
  // WebSocket (solo memoria, nunca BD)
  // ------------------------------------------------------------------
  conectarWebSocket() {
    if (!this.activo) return;

    console.log(`📡 [AIS] Conectando a AISStream (intento #${this.intentosReconexion + 1})...`);
    this.ws = AisStreamAdapter.conectar({
      alAbrir: () => {
        this.intentosReconexion = 0;
        this.enviarSuscripcion();
      },
      alMensaje: (msg) => {
        if (!msg) { this.metricas.descartadas++; return; }
        try {
          this.procesarTrama(msg);
        } catch (_) {
          this.metricas.descartadas++;
        }
      },
      alError: (err) => console.error('❌ [AIS] Error en el WebSocket:', err.message),
      alCerrar: (codigo, razon) => this.alCerrarConexion(codigo, razon),
    });
  }

  alCerrarConexion(codigo, razon) {
    if (!this.activo) return;
    if (this.reconectarYa) {
      this.reconectarYa = false;
      this.intentosReconexion = 0;
      setTimeout(() => this.conectarWebSocket(), 500);
      return;
    }
    console.warn(`⚠️ [AIS] Conexión cerrada (${codigo}${razon?.length ? ` · ${razon}` : ''}).`);
    this.programarReconexion();
  }

  programarReconexion() {
    const retraso = Math.min(this.retrasoBase * 2 ** this.intentosReconexion, this.retrasoMaximo);
    this.intentosReconexion++;
    console.log(`🔁 [AIS] Reconectando en ${retraso / 1000} s...`);
    setTimeout(() => this.conectarWebSocket(), retraso);
  }

  procesarTrama(msg, ahora = Date.now()) {
    this.metricas.tramas++;
    if (msg?.error) {
      console.error('❌ [AIS] AISStream respondió con error:', msg.error);
      return;
    }

    if (msg.MessageType === 'PositionReport') {
      const r = msg.Message?.PositionReport;
      if (!r || !Number.isFinite(r.Latitude) || !Number.isFinite(r.Longitude)) {
        this.metricas.descartadas++;
        return;
      }
      // AIS usa 91/181 como "posición no disponible"
      if (Math.abs(r.Latitude) > 90 || Math.abs(r.Longitude) > 180) {
        this.metricas.descartadas++;
        return;
      }

      const nave = this.obtenerNave(String(r.UserID));
      nave.lat = r.Latitude;
      nave.lon = r.Longitude;
      nave.velocidad = r.Sog;
      nave.rumbo = r.Cog;
      nave.navStatus = normalizarNavStatus(r.NavigationalStatus);
      nave.zona = this.ubicarZona(r.Longitude, r.Latitude);
      nave.puerto = this.puertoDeNave(r.Longitude, r.Latitude, nave.zona);
      if (!nave.nombre_motonave && msg.MetaData?.ShipName) nave.nombre_motonave = msg.MetaData.ShipName.trim() || null;
      nave.t = ahora;

      this.actualizarEstado(nave, inferirEstadoNave({ navStatus: nave.navStatus, sog: r.Sog, zona: nave.zona }), ahora);

      nave.pendienteBD = true;
      nave.pendienteSocket = true;
    } else if (msg.MessageType === 'ShipStaticData') {
      const s = msg.Message?.ShipStaticData;
      if (!s) return;
      const nave = this.obtenerNave(String(s.UserID));
      nave.nombre_motonave = s.Name?.trim() || nave.nombre_motonave;
      nave.destino = s.Destination?.trim() || nave.destino;
      if (nave.lat != null) nave.pendienteBD = true; // solo se persiste si ya hay posición
    }
  }

  /**
   * Máquina de estados con histéresis: el estado candidato debe sostenerse `confirmacionMs`
   * antes de reemplazar al vigente. Los estados críticos se confirman de inmediato.
   */
  actualizarEstado(nave, candidato, ahora) {
    // Primera trama de esta nave en memoria
    if (!nave.estado) {
      if (candidato === ESTADOS_NAVE.DESCONOCIDO) return;
      const sembrado = this.estadosSembrados.get(nave.mmsi);
      this.estadosSembrados.delete(nave.mmsi);
      if (sembrado && sembrado.estado === candidato) {
        nave.estado = candidato;
        nave.estadoDesde = sembrado.desde || ahora;
        return;
      }
      nave.estado = candidato;
      nave.estadoDesde = ahora;
      if (sembrado) this.registrarCambio(nave, sembrado.estado, sembrado.desde, ahora);
      return;
    }

    if (candidato === nave.estado || candidato === ESTADOS_NAVE.DESCONOCIDO) {
      nave.candidato = null;
      nave.candidatoDesde = null;
      return;
    }

    if (candidato !== nave.candidato) {
      nave.candidato = candidato;
      nave.candidatoDesde = ahora;
    }

    if (ESTADOS_CRITICOS.has(candidato) || ahora - nave.candidatoDesde >= this.confirmacionMs) {
      const anterior = nave.estado;
      const anteriorDesde = nave.estadoDesde;
      const desde = ESTADOS_CRITICOS.has(candidato) ? ahora : nave.candidatoDesde; // el cambio empezó cuando apareció el candidato
      nave.estado = candidato;
      nave.estadoDesde = desde;
      nave.candidato = null;
      nave.candidatoDesde = null;
      this.registrarCambio(nave, anterior, anteriorDesde, desde);
    }
  }

  registrarCambio(nave, estadoAnterior, anteriorDesde, fecha) {
    this.metricas.cambiosEstado++;
    const evento = {
      mmsi: nave.mmsi,
      nombre_motonave: nave.nombre_motonave || null,
      estado_anterior: estadoAnterior || null,
      estado_nuevo: nave.estado,
      id_puerto: nave.zona?.id_puerto || null,
      id_terminal: nave.zona?.id_terminal || null,
      codigo_muelle: nave.zona?.codigo_muelle || null,
      lat: nave.lat,
      lon: nave.lon,
      velocidad: Number.isFinite(nave.velocidad) ? nave.velocidad : null,
      nav_status: nave.navStatus,
      duracion_anterior_min: anteriorDesde ? (fecha - anteriorDesde) / 60000 : null,
      fecha,
      salas: nave.puerto?.salas || [],
    };

    this.eventosPorEmitir.push(evento);
    if (this.capacidades.tablaEventos) {
      this.eventosPorPersistir.push(evento);
      if (this.eventosPorPersistir.length > MAX_EVENTOS_EN_COLA) {
        this.eventosPorPersistir.splice(0, this.eventosPorPersistir.length - MAX_EVENTOS_EN_COLA);
      }
    }
  }

  obtenerNave(mmsi) {
    let nave = this.naves.get(mmsi);
    if (!nave) {
      nave = { mmsi, lat: null, lon: null, nombre_motonave: null, destino: null, estado: null, estadoDesde: null, t: Date.now() };
      this.naves.set(mmsi, nave);
    }
    return nave;
  }

  // ------------------------------------------------------------------
  // Salidas agrupadas: BD y socket
  // ------------------------------------------------------------------
  async persistirBuffer() {
    if (this.flushEnCurso) return;
    this.flushEnCurso = true;

    try {
      const ahora = Date.now();
      for (const [mmsi, nave] of this.naves) {
        if (ahora - nave.t > VIGENCIA_EN_MEMORIA_MS && !nave.pendienteBD) this.naves.delete(mmsi);
      }

      const pendientes = [...this.naves.values()].filter((n) => n.pendienteBD && n.lat != null);
      pendientes.forEach((n) => { n.pendienteBD = false; });

      const opciones = { extendido: this.capacidades.columnasExtendidas };
      for (let i = 0; i < pendientes.length; i += TAMANO_LOTE_BD) {
        const lote = pendientes.slice(i, i + TAMANO_LOTE_BD).map((n) => ({ ...n, estadoInferido: n.estado || ESTADOS_NAVE.DESCONOCIDO }));
        try {
          this.metricas.persistidas += await MaritimoRepository.guardarPosicionesAISLote(lote, opciones);
        } catch (error) {
          this.metricas.erroresBD++;
          pendientes.slice(i).forEach((n) => { n.pendienteBD = true; }); // se reintenta en el siguiente ciclo
          console.error(`❌ [AIS] Error persistiendo lote de ${lote.length} naves:`, error.message);
          break;
        }
      }

      await this.persistirEventos();
    } finally {
      this.flushEnCurso = false;
    }
  }

  async persistirEventos() {
    while (this.eventosPorPersistir.length > 0) {
      const lote = this.eventosPorPersistir.splice(0, TAMANO_LOTE_EVENTOS);
      try {
        await MaritimoRepository.guardarEventosEstadoNaveLote(lote);
      } catch (error) {
        this.metricas.erroresBD++;
        this.eventosPorPersistir.unshift(...lote);
        console.error(`❌ [AIS] Error guardando ${lote.length} eventos de estado:`, error.message);
        return;
      }
    }
  }

  construirFeature(nave, ahora = Date.now()) {
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [nave.lon, nave.lat] },
      properties: {
        mmsi: nave.mmsi,
        nombre_motonave: nave.nombre_motonave || 'DESCONOCIDO',
        destino: nave.destino,
        velocidad: nave.velocidad,
        rumbo: nave.rumbo,
        timestamp: new Date(nave.t).toISOString(),
        // estado_nave queda para el estado DIMAR (AVISADAS / FONDEADAS / ARRIBADAS); el de AIS va aparte
        estado_ais: nave.estado || ESTADOS_NAVE.DESCONOCIDO,
        estado_ais_desde: nave.estadoDesde ? new Date(nave.estadoDesde).toISOString() : null,
        minutos_en_estado: nave.estadoDesde ? Math.round((ahora - nave.estadoDesde) / 60000) : null,
        estado_nav_ais: nave.navStatus ?? null,
        estado_nav_ais_texto: textoNavStatus(nave.navStatus),
        puerto_radar: nave.puerto?.id_puerto || nave.puerto?.nombre || null,
        id_puerto: nave.zona?.id_puerto || null,
        id_terminal: nave.zona?.id_terminal || null,
        codigo_muelle: nave.zona?.codigo_muelle || null,
        zona_ais: nave.zona?.nombre_zona || null,
      },
    };
  }

  /** Cada nave va solo a la sala de su puerto: quien mira Buenaventura no recibe Cartagena. */
  emitirCambios() {
    if (!this.io) return;
    const ahora = Date.now();

    for (const nave of this.naves.values()) {
      if (!nave.pendienteSocket) continue;
      nave.pendienteSocket = false;
      if (!nave.puerto?.salas?.length) continue;
      this.io.to(nave.puerto.salas).emit('radar-actualizado', this.construirFeature(nave, ahora));
    }

    if (this.eventosPorEmitir.length > 0) {
      const eventos = this.eventosPorEmitir.splice(0);
      for (const { salas, ...e } of eventos) {
        if (!salas?.length) continue;
        this.io.to(salas).emit('nave-cambio-estado', {
          ...e,
          fecha: new Date(e.fecha).toISOString(),
          duracion_anterior_min: e.duracion_anterior_min != null ? Math.round(e.duracion_anterior_min) : null,
        });
      }
    }
  }
}

module.exports = new AISStreamService();
module.exports.AISStreamService = AISStreamService;
