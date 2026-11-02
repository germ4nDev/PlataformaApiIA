/*
    Author: German Valencia
    Pattern: PORTTOS Service - Simulador de operación portuaria (proceso 'simulador-operacion', cada 5 min)
    Description: Mientras las terminales no envían datos por la ingesta, mantiene viva la operación de granel, Ro-Ro,
      vehículos, carga suelta, ocupación de nodos y citas del Virtual Gate. Puertos: SIMULADOR_OPERACION_PUERTOS si está;
      si no, todos los activos del maestro (OT-009: ningún puerto del selector sin datos). Corre también en producción
      (decisión del usuario, 2026-10-29); cada dominio se apaga con SIMULADOS_<DOMINIO>=false (GATE, BODEGAS,
      CONTENEDORES, BUQUES, GRANEL, SUELTA, CAPACIDAD). Todo lo que escribe va con fuente SIMULADOR y simulado = 1, y los tableros lo rotulan.
      Regla de convivencia: si en las últimas 24 h llegó un dato real (simulado = 0) de un segmento en un puerto, el
      simulador deja ese segmento de ese puerto quieto. Sin la migración 013 se apaga solo; sin la 021, solo el gate.
      Las reglas (rendimientos, tiempos, estados) están en utils/simulador-operacion.js, utils/simulador-gate.js,
      utils/simulador-bodegas.js, utils/simulador-contenedores.js,
      utils/simulador-nodos.js y utils/simulador-buques.js.
*/
const OperacionRepository = require('../../repositories/torre-control/operacion-portuaria.repository');
const CapacidadRepository = require('../../repositories/torre-control/capacidad.repository');
const VirtualGateRepository = require('../../repositories/torre-control/virtual-gate.repository');
const BodegasRepository = require('../../repositories/torre-control/bodegas.repository');
const ContenedoresRepository = require('../../repositories/torre-control/contenedores.repository');
const BuquesRepository = require('../../repositories/torre-control/buques-simulados.repository');
const MaritimoRepository = require('../../repositories/torre-control/maritimo.repository');
const { contextoPuerto } = require('../../helpers/puerto-contexto.helper');
const { emitir } = require('../../helpers/socket.helper');
const { salaPuerto } = require('../../helpers/salas.helper');
const S = require('../../utils/simulador-operacion');
const G = require('../../utils/simulador-gate');
const B = require('../../utils/simulador-bodegas');
const SC = require('../../utils/simulador-contenedores');
const { catalogoNodos } = require('../../utils/simulador-nodos');
const SB = require('../../utils/simulador-buques');

const H24 = 24 * 3600000;
const FOTO_CAPACIDAD_MS = 15 * 60000;
const REFRESCO_GATE_MS = 10 * 60000;
const REFRESCO_BODEGAS_MS = 30 * 60000;
const REFRESCO_CONTENEDORES_MS = 30 * 60000;
const REFRESCO_NODOS_MS = 30 * 60000;
const REFRESCO_BUQUES_MS = 10 * 60000;
const HORAS_AIS_REAL = 6;
const FUENTE = 'SIMULADOR';
const EQUIPOS_DE_DESCARGA = new Set(['ASPIRADOR', 'GRUA_MOVIL', 'CINTA']);
const iso = (ms) => new Date(ms).toISOString();

/** Puertos a simular: SIMULADOR_OPERACION_PUERTOS si está; si no, todos los puertos activos del maestro (OT-009). */
const puertosConfigurados = async (listarPuertos) => {
  const lista = (process.env.SIMULADOR_OPERACION_PUERTOS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (lista.length) return lista;
  return (await listarPuertos()).map((p) => String(p.id_puerto).trim()).filter(Boolean);
};

/** Interruptor por dominio: SIMULADOS_<DOMINIO>=false lo apaga (encendido por defecto, también en producción). */
const dominioEncendido = (dominio) => String(process.env[`SIMULADOS_${dominio}`] ?? 'true').toLowerCase() !== 'false';

class SimuladorOperacionService {
  constructor({ operacion = OperacionRepository, capacidad = CapacidadRepository, gate = VirtualGateRepository,
    bodegas = BodegasRepository, contenedores = ContenedoresRepository,
    buques = BuquesRepository, listarPuertos = () => MaritimoRepository.getPuertosActivos(), contexto = contextoPuerto, avisar = emitir, rng = Math.random } = {}) {
    Object.assign(this, { operacion, capacidadRepo: capacidad, gate, bodegasRepo: bodegas, contenedoresRepo: contenedores, buquesRepo: buques, listarPuertos, contexto, avisar, rng });
    this.ultimoCiclo = new Map();   // puerto → ms
    this.ultimoGate = new Map();    // puerto → ms de la última escritura de citas
    this.ultimoBodegas = new Map(); // puerto → ms de la última escritura de bodegas
    this.ultimoContenedores = new Map();
    this.ultimoNodos = new Map();
    this.ultimoBuques = new Map();
    this.activo = null;             // false = falta la migración 013
    this.gateActivo = null;         // false = falta la migración 021
    this.bodegasActivo = null;      // false = falta la migración 021
    this.contenedoresActivo = null; // false = falta la migración 021
    this.nodosActivo = null;        // false = falta la migración 021
    this.buquesActivo = null;       // false = falta la migración 021
    this.productividadActivo = null; // false = falta la migración 023 (productividad y reportes)
    this.contador = 0;
  }

  /** Un ciclo para todos los puertos configurados. Devuelve cuántos registros escribió. */
  async ciclo(ahora = new Date()) {
    if (this.activo === false) return 0;
    let escritos = 0;
    try {
      for (const puerto of await puertosConfigurados(this.listarPuertos)) escritos += await this.cicloPuerto(puerto, ahora);
      this.activo = true;
    } catch (error) {
      if (error?.codigo !== 'MIGRACION_PENDIENTE') throw error;
      console.warn('[SimuladorOperacion] Falta la migración 013: simulador apagado hasta reiniciar el API.');
      this.activo = false;
    }
    return escritos;
  }

  async cicloPuerto(puerto, ahora) {
    const p = await this.contexto(puerto);
    const ahoraMs = ahora.getTime();
    const previo = this.ultimoCiclo.get(p.clave) || ahoraMs - 5 * 60000;
    const dtH = Math.min(1, Math.max(0, (ahoraMs - previo) / 3600000));
    this.ultimoCiclo.set(p.clave, ahoraMs);
    const hace24 = iso(ahoraMs - H24);
    // Terminales: nodos de capacidad; si el puerto no los tiene, las del maestro de terminales
    const maestroTerminales = await this.gate.terminalesConMuelles(p.idPuerto).catch(() => []);
    await this.simularCatalogoNodos(p, maestroTerminales, ahoraMs);
    const terminales = (await this.capacidadRepo.nodos(p.idPuerto, 'TERMINAL')).map((n) => n.nombre);
    if (!terminales.length) terminales.push(...maestroTerminales.map((t) => t.nombre).filter(Boolean));
    if (!terminales.length) terminales.push('Terminal multipropósito');
    const escritosGate = await this.simularGate(p, maestroTerminales, ahoraMs);
    const escritosBodegas = await this.simularBodegas(p, maestroTerminales, ahoraMs);
    const escritosContenedores = await this.simularContenedores(p, maestroTerminales, ahoraMs);
    const escritosBuques = await this.simularBuques(p, ahoraMs);

    const [granelReal, sueltaReal, roroReal, vehiculosReal, capacidadReal] = await Promise.all([
      this.operacion.hayDatosReales('TCL_EquiposPortuarios', p.idPuerto, hace24),
      this.operacion.hayDatosReales('TCL_CargaSuelta', p.idPuerto, hace24),
      this.operacion.hayDatosReales('TCL_OperacionesBuque', p.idPuerto, hace24),
      this.operacion.hayDatosReales('TCL_InventarioVehiculos', p.idPuerto, hace24),
      this.capacidadRepo.hayDatosReales(p.idPuerto, hace24),
    ]);
    const base = { id_puerto: p.idPuerto, fuente: FUENTE, simulado: true };
    let escritos = escritosGate + escritosBodegas + escritosContenedores + escritosBuques;
    const modulos = new Set([...(escritosGate ? ['gate'] : []), ...(escritosBodegas ? ['bodegas'] : []),
      ...(escritosContenedores ? ['contenedores'] : []), ...(escritosBuques ? ['maritimo', 'mapa'] : [])]);

    const granel = dominioEncendido('GRANEL');
    const suelta = dominioEncendido('SUELTA');
    if (granel && !granelReal && !roroReal) { escritos += await this.simularGranel(p, base, terminales, dtH, ahoraMs); modulos.add('granel'); }
    const patios = await this.capacidadRepo.nodos(p.idPuerto, 'PATIO_PDI');
    if (suelta && !roroReal && !vehiculosReal) { escritos += await this.simularRoroYVehiculos(p, base, terminales, patios, dtH, ahoraMs); modulos.add('suelta'); }
    if (suelta && !sueltaReal) { escritos += await this.simularCargaSuelta(p, base, ahoraMs); modulos.add('suelta'); }
    if (dominioEncendido('CAPACIDAD') && !capacidadReal) { escritos += await this.simularCapacidad(p, base, ahoraMs); modulos.add('capacidad'); }

    for (const modulo of modulos) this.avisar('tablero-actualizado', { modulo, puerto: p.clave, simulado: true }, salaPuerto(p.clave, modulo));
    return escritos;
  }

  // ── Virtual Gate (OT-009) ──────────────────────────────────────────────────
  // Citas de las últimas 24 h y las próximas 24 h (utils/simulador-gate.js), reescritas cada 10 min porque su estado
  // depende del reloj. Si llegó una cita real del puerto en las últimas 24 h, se retiran las simuladas y no se escribe.
  async simularGate(p, maestroTerminales, ahoraMs) {
    if (this.gateActivo === false || !dominioEncendido('GATE')) return 0;
    if (ahoraMs - (this.ultimoGate.get(p.clave) || 0) < REFRESCO_GATE_MS) return 0;
    try {
      if (await this.gate.hayCitasReales(p.idPuerto, iso(ahoraMs - H24))) {
        await this.gate.retirarCitasSimuladas(p.idPuerto);
        this.ultimoGate.set(p.clave, ahoraMs);
        return 0;
      }
      const perfil = G.perfilPuerto(p.clave, maestroTerminales);
      const filas = G.citasVentana(perfil, ahoraMs).map((f) => ({ ...f, fuente: FUENTE, simulado: true }));
      const escritos = await this.gate.reemplazarCitasSimuladas(p.idPuerto, filas);
      this.gateActivo = true;
      this.ultimoGate.set(p.clave, ahoraMs);
      return escritos;
    } catch (error) {
      if (error?.codigo !== 'MIGRACION_PENDIENTE') throw error;
      console.warn('[SimuladorOperacion] Falta la migración 021: citas simuladas del Virtual Gate apagadas hasta reiniciar el API.');
      this.gateActivo = false;
      return 0;
    }
  }

  // ── Bodegas (OT-009) ───────────────────────────────────────────────────────
  // Catálogo: si el puerto no tiene bodegas reales se crean las simuladas (utils/simulador-bodegas.js) y su inventario
  // sigue la curva del núcleo; si aparece una bodega real, las simuladas se retiran. Movimientos de los últimos 7 días
  // (reales o simuladas las bodegas) reescritos cada 30 min mientras no llegue un movimiento real del puerto en 7 días.
  async simularBodegas(p, maestroTerminales, ahoraMs) {
    if (this.bodegasActivo === false || !dominioEncendido('BODEGAS')) return 0;
    if (ahoraMs - (this.ultimoBodegas.get(p.clave) || 0) < REFRESCO_BODEGAS_MS) return 0;
    const ahoraIso = iso(ahoraMs);
    try {
      const puertos = [p.clave, p.idPuerto];
      let bodegas = await this.bodegasRepo.obtenerMaestroBodegasPorPuerto(puertos);
      const reales = bodegas.filter((b) => !b.simulado);
      let escritos = 0;
      if (reales.length && bodegas.length > reales.length) {
        await this.bodegasRepo.retirarSimulados(p.idPuerto, { conCatalogo: true });
        bodegas = reales;
      }
      if (!reales.length) {
        const existentes = new Map(bodegas.map((b) => [b.codigo_bodega, b]));
        for (const b of B.catalogoSimulado(p.clave, maestroTerminales)) {
          const inv = B.inventario(p.clave, b, ahoraMs);
          const actual = existentes.get(b.codigo_bodega);
          if (actual) await this.bodegasRepo.actualizarInventarioSimulado(actual.id_bodega, inv.inventario_actual_ton, inv.estado_operativo, ahoraIso);
          else await this.bodegasRepo.crearBodegaSimulada(p.idPuerto, { ...b, ...inv }, ahoraIso);
          escritos++;
        }
        bodegas = await this.bodegasRepo.obtenerMaestroBodegasPorPuerto(puertos);
      }
      if (await this.bodegasRepo.hayMovimientosReales(puertos, iso(ahoraMs - B.DIAS_MOVIMIENTOS * H24))) {
        await this.bodegasRepo.retirarSimulados(p.idPuerto);
      } else {
        escritos += await this.bodegasRepo.reemplazarMovimientosSimulados(p.idPuerto, B.movimientosSimulados(p.clave, bodegas, ahoraMs));
      }
      this.bodegasActivo = true;
      this.ultimoBodegas.set(p.clave, ahoraMs);
      return escritos;
    } catch (error) {
      if (error?.codigo !== 'MIGRACION_PENDIENTE') throw error;
      console.warn('[SimuladorOperacion] Falta la migración 021: bodegas simuladas apagadas hasta reiniciar el API.');
      this.bodegasActivo = false;
      return 0;
    }
  }

  // ── Catálogo de nodos de capacidad (OT-009) ────────────────────────────────
  // Si el puerto no tiene nodos reales se crea el catálogo simulado (utils/simulador-nodos.js) con 24 h de fotos hacia
  // atrás, para que las tendencias no arranquen vacías; luego simularCapacidad() lo mantiene. Si aparece un nodo real,
  // los simulados (y sus fotos) se retiran. Lo apaga SIMULADOS_CAPACIDAD=false.
  async simularCatalogoNodos(p, maestroTerminales, ahoraMs) {
    if (this.nodosActivo === false || !dominioEncendido('CAPACIDAD')) return 0;
    if (ahoraMs - (this.ultimoNodos.get(p.clave) || 0) < REFRESCO_NODOS_MS) return 0;
    try {
      const nodos = await this.capacidadRepo.nodos(p.idPuerto);
      const simulados = nodos.filter((n) => n.fuente === FUENTE);
      let escritos = 0;
      if (nodos.length > simulados.length) {
        if (simulados.length) await this.capacidadRepo.retirarNodosSimulados(p.idPuerto);
      } else if (!simulados.length) {
        const catalogo = catalogoNodos(p.clave, maestroTerminales);
        escritos += await this.capacidadRepo.guardarNodosSimulados(p.idPuerto, catalogo, iso(ahoraMs));
        const fotos = [];
        const previo = new Map();
        for (let h = 24; h >= 1; h--) {
          const fecha = iso(ahoraMs - h * 3600000);
          for (const n of catalogo) {
            const pct = S.siguienteOcupacion(n.id_nodo, previo.get(n.id_nodo), this.rng);
            previo.set(n.id_nodo, pct);
            fotos.push({ id_puerto: p.idPuerto, fuente: FUENTE, simulado: true, id_nodo: n.id_nodo, fecha, ocupacion_pct: pct,
              ocupacion: Math.round((Number(n.capacidad) || 0) * pct / 100), ...S.traficoNodo(n.categoria, pct, this.rng) });
          }
        }
        escritos += await this.capacidadRepo.guardarOcupaciones(fotos);
      }
      this.nodosActivo = true;
      this.ultimoNodos.set(p.clave, ahoraMs);
      return escritos;
    } catch (error) {
      if (error?.codigo !== 'MIGRACION_PENDIENTE') throw error;
      console.warn('[SimuladorOperacion] Falta una migración (013 o 021): catálogo simulado de nodos apagado hasta reiniciar el API.');
      this.nodosActivo = false;
      return 0;
    }
  }

  // ── Contenedores en patio (OT-009) ─────────────────────────────────────────
  // Inventario de TCL_InventarioContenedores (utils/simulador-contenedores.js) reescrito cada 30 min mientras el puerto no
  // tenga inventario real; si llega uno real, se retira el simulado. Lo apaga SIMULADOS_CONTENEDORES=false.
  async simularContenedores(p, maestroTerminales, ahoraMs) {
    if (this.contenedoresActivo === false || !dominioEncendido('CONTENEDORES')) return 0;
    if (ahoraMs - (this.ultimoContenedores.get(p.clave) || 0) < REFRESCO_CONTENEDORES_MS) return 0;
    try {
      let escritos = 0;
      if (await this.contenedoresRepo.hayInventarioReal(p.idPuerto)) await this.contenedoresRepo.retirarInventarioSimulado(p.idPuerto);
      else escritos = await this.contenedoresRepo.reemplazarInventarioSimulado(p.idPuerto, SC.inventarioEnPatio(p.clave, maestroTerminales, ahoraMs));
      this.contenedoresActivo = true;
      this.ultimoContenedores.set(p.clave, ahoraMs);
      return escritos;
    } catch (error) {
      if (error?.codigo !== 'MIGRACION_PENDIENTE') throw error;
      console.warn('[SimuladorOperacion] Falta la migración 021: contenedores simulados apagados hasta reiniciar el API.');
      this.contenedoresActivo = false;
      return 0;
    }
  }

  // ── Buques (OT-009) ────────────────────────────────────────────────────────
  // Mientras el AIS no reporte en el puerto: naves simuladas (utils/simulador-buques.js) fondeadas en el punto de fondeo
  // del maestro (migración 022) y atracadas en su muelle, con sus eventos (espera en fondeo, estadía) y los avisos de
  // arribo de 72 h, y el line-up de esas mismas escalas (TCL_LineUpMaritimo, con el nombre del puerto del maestro). Nombre
  // 'SIM · …' y MMSI 'SIM…'. Lo real gana por parte: AIS real en 6 h → se retiran posiciones y eventos; avisos DIMAR reales
  // en la ventana → se retiran los avisos; line-up real en la ventana → se retira el line-up. Con la 023, también la
  // productividad de hoy por terminal y los reportes operativos (atraques, zarpes, esperas largas, arribos próximos), cada uno
  // retirado si llega su dato real. Cada 10 min. SIMULADOS_BUQUES.
  async simularBuques(p, ahoraMs) {
    if (this.buquesActivo === false || !dominioEncendido('BUQUES')) return 0;
    if (ahoraMs - (this.ultimoBuques.get(p.clave) || 0) < REFRESCO_BUQUES_MS) return 0;
    try {
      const [info, muelles, aisReal] = await Promise.all([
        this.buquesRepo.puerto(p.idPuerto), this.buquesRepo.muelles(p.idPuerto), this.buquesRepo.hayAisReal(p.idPuerto, HORAS_AIS_REAL),
      ]);
      const desde = iso(ahoraMs - SB.PARAMETROS.horasAvisosAtras * 3600000);
      const hasta = iso(ahoraMs + SB.PARAMETROS.horasAvisos * 3600000);
      const [avisosReales, lineUpReal] = await Promise.all([
        this.buquesRepo.hayAvisosReales(info.capitania, desde, hasta),
        this.buquesRepo.hayLineUpReal(p.nombre, iso(ahoraMs - H24), hasta),
      ]);
      // Productividad y reportes (migración 023): si llegó dato real desde ayer / en 48 h, no se simulan
      let productividadReal = true;
      let reportesReales = true;
      if (this.productividadActivo !== false) {
        try {
          [productividadReal, reportesReales] = await Promise.all([
            this.buquesRepo.hayProductividadReal(p.idPuerto, new Date(ahoraMs - 29 * 3600000).toISOString().slice(0, 10)),
            this.buquesRepo.hayReportesReales(p.idPuerto, iso(ahoraMs - 48 * 3600000)),
          ]);
          this.productividadActivo = true;
        } catch (error) {
          if (error?.codigo !== 'MIGRACION_PENDIENTE') throw error;
          console.warn('[SimuladorOperacion] Falta la migración 023: productividad y reportes simulados apagados hasta reiniciar el API.');
          this.productividadActivo = false;
        }
      }
      const retiro = { ais: aisReal, avisos: avisosReales, lineUp: lineUpReal,
        productividad: this.productividadActivo === true && productividadReal, reportes: this.productividadActivo === true && reportesReales };
      if (Object.values(retiro).some(Boolean)) await this.buquesRepo.retirar(p.idPuerto, retiro, p.nombre);
      let escritos = 0;
      if (!aisReal || !avisosReales || !lineUpReal || !productividadReal || !reportesReales) {
        const lista = SB.escalas(p.clave, muelles.map((m) => ({ ...m, lat: m.lat === null ? null : Number(m.lat), lon: m.lon === null ? null : Number(m.lon) })), ahoraMs);
        escritos = await this.buquesRepo.reemplazar(p.idPuerto, {
          posiciones: aisReal ? null : SB.posiciones(p.clave, lista, info.fondeo, ahoraMs),
          eventos: aisReal ? null : SB.eventos(lista, ahoraMs),
          avisos: avisosReales ? null : SB.avisos(lista, info.capitania, ahoraMs),
          lineUp: lineUpReal ? null : SB.lineUp(lista, ahoraMs),
          productividad: productividadReal ? null : SB.productividad(lista, muelles, ahoraMs),
          reportes: reportesReales ? null : SB.reportes(lista, ahoraMs),
        }, iso(ahoraMs), p.nombre);
      }
      this.buquesActivo = true;
      this.ultimoBuques.set(p.clave, ahoraMs);
      return escritos;
    } catch (error) {
      if (error?.codigo !== 'MIGRACION_PENDIENTE') throw error;
      console.warn('[SimuladorOperacion] Falta la migración 021: buques simulados apagados hasta reiniciar el API.');
      this.buquesActivo = false;
      return 0;
    }
  }

  // ── Granel ─────────────────────────────────────────────────────────────────
  async simularGranel(p, base, terminales, dtH, ahoraMs) {
    const ahoraIso = iso(ahoraMs);
    let equipos = (await this.operacion.equipos(p.idPuerto, ['GRANEL'])).filter((e) => e.simulado);
    if (!equipos.length) {
      for (const e of S.equiposIniciales(terminales[0])) await this.operacion.guardarEquipo({ ...e, ...base }, ahoraIso);
      equipos = (await this.operacion.equipos(p.idPuerto, ['GRANEL'])).filter((e) => e.simulado);
    }
    const ops = (await this.operacion.operaciones(p.idPuerto, 'GRANEL', iso(ahoraMs - H24))).filter((o) => o.simulado);
    const activas = ops.filter((o) => o.estado !== 'TERMINADA');
    const meta = Math.round(S.PARAMETROS.operacionesGranel[0] + S.hashTexto(p.clave) * (S.PARAMETROS.operacionesGranel[1] - S.PARAMETROS.operacionesGranel[0]));
    let escritos = 0;
    for (let i = activas.length; i < meta; i++) {
      const nueva = S.nuevaOperacionGranel(this.rng, ahoraMs, terminales, this.contador++);
      nueva.id_operacion = await this.operacion.guardarOperacion({ ...nueva, ...base }, ahoraIso);
      activas.push(nueva);
      escritos++;
    }

    for (const op of activas) {
      let asignados = equipos.filter((e) => String(e.id_operacion) === String(op.id_operacion));
      const estadoAntes = op.estado;
      // Al empezar a operar se le asignan 2 o 3 equipos libres
      if (op.estado !== 'TERMINADA' && Date.parse(op.fecha_inicio) <= ahoraMs && !asignados.some((e) => EQUIPOS_DE_DESCARGA.has(e.tipo))) {
        const libres = equipos.filter((e) => e.estado === 'LIBRE' && EQUIPOS_DE_DESCARGA.has(e.tipo));
        const n = S.entero(this.rng, ...S.PARAMETROS.equiposPorOperacion);
        asignados = libres.slice(0, n);
        const volqueta = equipos.find((e) => e.tipo === 'VOLQUETA' && e.estado === 'LIBRE');
        if (volqueta && op.tipo !== 'LIQUIDO') asignados.push(volqueta);
      }
      const rendimiento = asignados.filter((e) => EQUIPOS_DE_DESCARGA.has(e.tipo))
        .reduce((t, e) => t + (Number(e.capacidad_tmh) || 0) * S.entre(this.rng, ...S.PARAMETROS.factorRendimiento), 0);
      const operado = S.avanzarOperacion(op, dtH, rendimiento, ahoraMs);
      if (operado > 0) {
        await this.operacion.guardarAvance([{ id_operacion: op.id_operacion, id_puerto: p.idPuerto, segmento: 'GRANEL', hora: S.horaDe(ahoraMs), cantidad: operado, fuente: FUENTE, simulado: true }], 'sumar');
      }
      if (operado > 0 || op.estado !== estadoAntes) { await this.operacion.guardarOperacion({ ...op, ...base }, ahoraIso); escritos++; }
      for (const e of asignados) {
        const libre = op.estado === 'TERMINADA';
        const enUso = op.estado === 'OPERANDO';
        await this.operacion.guardarEquipo({
          ...e, ...base, id_operacion: libre ? null : op.id_operacion, motonave: libre ? null : op.motonave, producto: libre ? null : op.producto,
          estado: libre ? 'LIBRE' : enUso ? (e.tipo === 'VOLQUETA' ? 'EN_RUTA' : 'OPERANDO') : 'LIBRE',
          rendimiento_tmh: enUso && EQUIPOS_DE_DESCARGA.has(e.tipo) ? Math.round((Number(e.capacidad_tmh) || 0) * S.entre(this.rng, ...S.PARAMETROS.factorRendimiento)) : null,
        }, ahoraIso);
        e.estado = libre ? 'LIBRE' : 'OPERANDO'; e.id_operacion = libre ? null : op.id_operacion;
      }
    }
    return escritos;
  }

  // ── Ro-Ro y patios de vehículos ────────────────────────────────────────────
  async simularRoroYVehiculos(p, base, terminales, patios, dtH, ahoraMs) {
    const ahoraIso = iso(ahoraMs);
    let escritos = 0;
    const ops = (await this.operacion.operaciones(p.idPuerto, 'RORO', iso(ahoraMs - H24))).filter((o) => o.simulado);
    const activas = ops.filter((o) => o.estado !== 'TERMINADA');
    // Un buque en puerto (o por llegar en unas horas) y otro programado
    if (!activas.length) activas.push(await this._nuevoRoro(p, base, terminales, ahoraMs, S.entre(this.rng, 0, 2)));
    if (activas.length < 2) activas.push(await this._nuevoRoro(p, base, terminales, ahoraMs, S.entre(this.rng, 18, 48)));

    let descargados = 0;
    let marcasDescarga = [];
    for (const op of activas) {
      const estadoAntes = op.estado;
      const ritmo = (S.PARAMETROS.ritmoRoroUdsMin[0] + S.hashTexto(op.codigo_externo) * (S.PARAMETROS.ritmoRoroUdsMin[1] - S.PARAMETROS.ritmoRoroUdsMin[0])) * 60;
      const operado = S.avanzarOperacion(op, dtH, ritmo, ahoraMs);
      if (operado > 0) {
        descargados += operado;
        marcasDescarga = String(op.producto || '').split('/').map((m) => m.trim()).filter(Boolean);
        await this.operacion.guardarAvance([{ id_operacion: op.id_operacion, id_puerto: p.idPuerto, segmento: 'RORO', hora: S.horaDe(ahoraMs), cantidad: operado, fuente: FUENTE, simulado: true }], 'sumar');
      }
      if (operado > 0 || op.estado !== estadoAntes) { await this.operacion.guardarOperacion({ ...op, ...base }, ahoraIso); escritos++; }
    }

    // Patios: inventario inicial, entrada de lo descargado y salida de niñeras hacia el interior
    if (!patios.length) return escritos;
    const inventario = (await this.operacion.vehiculos(p.idPuerto)).filter((v) => v.simulado);
    const filas = [];
    patios.forEach((patio, i) => {
      const flujo = /EXPORT/i.test(patio.id_nodo + patio.nombre) ? 'EXPORTACION' : 'IMPORTACION';
      const marcas = flujo === 'EXPORTACION' ? ['Varias'] : [S.MARCAS[(2 * i) % S.MARCAS.length], S.MARCAS[(2 * i + 1) % S.MARCAS.length]];
      const capacidad = Number(patio.capacidad) || 100;
      marcas.forEach((marca, j) => {
        const actual = inventario.find((v) => v.id_nodo === patio.id_nodo && v.marca === marca && v.flujo === flujo);
        let unidades = actual ? Number(actual.unidades) : Math.round(capacidad * S.entre(this.rng, 0.5, 0.85) / marcas.length);
        const salen = unidades * S.entre(this.rng, ...S.PARAMETROS.salidaPatioPorHora) * dtH;
        unidades = Math.max(0, unidades - Math.round(salen + (this.rng() < salen % 1 ? 1 : 0)));
        if (flujo === 'IMPORTACION' && descargados > 0 && marcasDescarga.includes(marca)) {
          unidades += Math.round(descargados / Math.max(1, marcasDescarga.length * 2));
        }
        if (flujo === 'EXPORTACION') unidades += Math.round(S.entre(this.rng, 0, 4) * dtH * 4);
        unidades = Math.min(Math.round(capacidad / marcas.length * 1.05), unidades);
        const dias = actual?.dias_promedio ? Math.max(2, Math.min(15, Number(actual.dias_promedio) + S.entre(this.rng, -0.2, 0.2))) : S.entre(this.rng, 5, 10);
        filas.push({ ...base, id_nodo: patio.id_nodo, marca, flujo, unidades, dias_promedio: Math.round(dias * 10) / 10, fecha_corte: ahoraIso, j });
      });
    });
    for (const { j, ...f } of filas) await this.operacion.guardarVehiculos(f);
    return escritos + filas.length;
  }

  async _nuevoRoro(p, base, terminales, ahoraMs, horasHastaEta) {
    const op = S.nuevaOperacionRoro(this.rng, ahoraMs, terminales, this.contador++, horasHastaEta);
    op.id_operacion = await this.operacion.guardarOperacion({ ...op, ...base }, iso(ahoraMs));
    return op;
  }

  // ── Carga suelta ───────────────────────────────────────────────────────────
  async simularCargaSuelta(p, base, ahoraMs) {
    const ahoraIso = iso(ahoraMs);
    const folios = (await this.operacion.folios(p.idPuerto, iso(ahoraMs - H24))).filter((f) => f.simulado)
      .map((f) => ({ ...f, requiere_permiso: !!f.requiere_permiso, permiso_aprobado: f.permiso_aprobado === null ? null : !!f.permiso_aprobado }));
    const activos = folios.filter((f) => f.estado !== 'DESPACHADO');
    const motonave = 'BBC ' + ['ATLANTIC', 'PACIFIC', 'ANDES', 'CARIBE'][Math.floor(ahoraMs / 86400000) % 4];
    const nuevos = [];
    for (let i = activos.filter((f) => f.clase === 'BREAK_BULK').length; i < S.PARAMETROS.foliosBreakBulk; i++) nuevos.push(S.nuevoFolioBreakBulk(this.rng, ahoraMs, this.contador++, motonave));
    for (let i = activos.filter((f) => f.clase === 'PROJECT_CARGO').length; i < S.PARAMETROS.proyectos; i++) nuevos.push(S.nuevoProyecto(this.rng, ahoraMs, this.contador++, motonave));
    let escritos = 0;
    for (const f of [...activos, ...nuevos]) {
      const antes = JSON.stringify([f.estado, f.bultos_recibidos, f.permiso_aprobado]);
      S.avanzarFolio(f, ahoraMs, this.rng);
      if (nuevos.includes(f) || antes !== JSON.stringify([f.estado, f.bultos_recibidos, f.permiso_aprobado])) {
        await this.operacion.guardarFolio({ ...f, ...base }, ahoraIso);
        escritos++;
      }
    }
    return escritos;
  }

  // ── Capacidad ──────────────────────────────────────────────────────────────
  async simularCapacidad(p, base, ahoraMs) {
    const [nodos, bodegas, fotos, vehiculos] = await Promise.all([
      this.capacidadRepo.nodos(p.idPuerto),
      this.capacidadRepo.bodegas(p.idPuerto, p.clave),
      this.capacidadRepo.ocupaciones(p.idPuerto, iso(ahoraMs - 2 * 3600000)),
      this.operacion.vehiculos(p.idPuerto),
    ]);
    const ultima = new Map();
    for (const f of fotos) if (!ultima.has(f.id_nodo) || f.fecha > ultima.get(f.id_nodo).fecha) ultima.set(f.id_nodo, f);
    const reciente = [...ultima.values()].some((f) => ahoraMs - Date.parse(f.fecha) < FOTO_CAPACIDAD_MS - 60000);
    if (reciente) return 0;

    const unidadesPatio = new Map();
    for (const v of vehiculos) unidadesPatio.set(v.id_nodo, (unidadesPatio.get(v.id_nodo) || 0) + Number(v.unidades || 0));
    const filas = [];
    const fecha = iso(ahoraMs);
    for (const n of nodos) {
      const capacidad = Number(n.capacidad) || 0;
      const pct = n.categoria === 'PATIO_PDI' && unidadesPatio.has(n.id_nodo) && capacidad > 0
        ? Math.round((unidadesPatio.get(n.id_nodo) / capacidad) * 1000) / 10
        : S.siguienteOcupacion(n.id_nodo, ultima.get(n.id_nodo)?.ocupacion_pct, this.rng);
      filas.push({ ...base, id_nodo: n.id_nodo, fecha, ocupacion_pct: pct, ocupacion: Math.round(capacidad * pct / 100), ...S.traficoNodo(n.categoria, pct, this.rng) });
    }
    for (const b of bodegas) {
      const pct = b.capacidad_maxima_ton > 0 ? Math.round((b.inventario_actual_ton / b.capacidad_maxima_ton) * 1000) / 10 : 0;
      filas.push({ ...base, id_nodo: `BOD-${b.id_bodega}`, fecha, ocupacion_pct: pct, ocupacion: b.inventario_actual_ton, ...S.traficoNodo('BODEGA', pct, this.rng) });
    }
    return this.capacidadRepo.guardarOcupaciones(filas);
  }

  /** Retención: avance y fotos de más de 30 días. */
  async limpiar(ahora = new Date()) {
    if (this.activo === false) return 0;
    const antes = iso(ahora.getTime() - 30 * 86400000);
    try {
      await this.operacion.purgar(antes);
      await this.capacidadRepo.purgar(antes);
    } catch (error) {
      if (error?.codigo !== 'MIGRACION_PENDIENTE') throw error;
      this.activo = false;
    }
    return 0;
  }
}

module.exports = new SimuladorOperacionService();
module.exports.SimuladorOperacionService = SimuladorOperacionService;
