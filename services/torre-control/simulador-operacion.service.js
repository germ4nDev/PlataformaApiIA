/*
    Author: German Valencia
    Pattern: PORTTOS Service - Simulador de operación portuaria (proceso 'simulador-operacion', cada 5 min, fuera de producción)
    Description: Mientras las terminales no envían datos por la ingesta, mantiene viva la operación de granel, Ro-Ro,
      vehículos, carga suelta y ocupación de nodos de los puertos de SIMULADOR_OPERACION_PUERTOS (por defecto
      BUENAVENTURA). Todo lo que escribe va con fuente SIMULADOR y simulado = 1, y los tableros lo rotulan.
      Regla de convivencia: si en las últimas 24 h llegó un dato real (simulado = 0) de un segmento en un puerto, el
      simulador deja ese segmento de ese puerto quieto. Sin la migración 013 se apaga solo.
      Las reglas (rendimientos, tiempos, estados) están en utils/simulador-operacion.js.
*/
const OperacionRepository = require('../../repositories/torre-control/operacion-portuaria.repository');
const CapacidadRepository = require('../../repositories/torre-control/capacidad.repository');
const { contextoPuerto } = require('../../helpers/puerto-contexto.helper');
const { emitir } = require('../../helpers/socket.helper');
const { salaPuerto } = require('../../helpers/salas.helper');
const S = require('../../utils/simulador-operacion');

const H24 = 24 * 3600000;
const FOTO_CAPACIDAD_MS = 15 * 60000;
const FUENTE = 'SIMULADOR';
const EQUIPOS_DE_DESCARGA = new Set(['ASPIRADOR', 'GRUA_MOVIL', 'CINTA']);
const iso = (ms) => new Date(ms).toISOString();

const puertosConfigurados = () => (process.env.SIMULADOR_OPERACION_PUERTOS || 'BUENAVENTURA')
  .split(',').map((s) => s.trim()).filter(Boolean);

class SimuladorOperacionService {
  constructor({ operacion = OperacionRepository, capacidad = CapacidadRepository, contexto = contextoPuerto, avisar = emitir, rng = Math.random } = {}) {
    Object.assign(this, { operacion, capacidadRepo: capacidad, contexto, avisar, rng });
    this.ultimoCiclo = new Map();   // puerto → ms
    this.activo = null;             // false = falta la migración 013
    this.contador = 0;
  }

  /** Un ciclo para todos los puertos configurados. Devuelve cuántos registros escribió. */
  async ciclo(ahora = new Date()) {
    if (this.activo === false) return 0;
    let escritos = 0;
    try {
      for (const puerto of puertosConfigurados()) escritos += await this.cicloPuerto(puerto, ahora);
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
    const terminales = (await this.capacidadRepo.nodos(p.idPuerto, 'TERMINAL')).map((n) => n.nombre);
    if (!terminales.length) terminales.push('Terminal multipropósito');

    const [granelReal, sueltaReal, roroReal, vehiculosReal, capacidadReal] = await Promise.all([
      this.operacion.hayDatosReales('TCL_EquiposPortuarios', p.idPuerto, hace24),
      this.operacion.hayDatosReales('TCL_CargaSuelta', p.idPuerto, hace24),
      this.operacion.hayDatosReales('TCL_OperacionesBuque', p.idPuerto, hace24),
      this.operacion.hayDatosReales('TCL_InventarioVehiculos', p.idPuerto, hace24),
      this.capacidadRepo.hayDatosReales(p.idPuerto, hace24),
    ]);
    const base = { id_puerto: p.idPuerto, fuente: FUENTE, simulado: true };
    let escritos = 0;
    const modulos = new Set();

    if (!granelReal && !roroReal) { escritos += await this.simularGranel(p, base, terminales, dtH, ahoraMs); modulos.add('granel'); }
    const patios = await this.capacidadRepo.nodos(p.idPuerto, 'PATIO_PDI');
    if (!roroReal && !vehiculosReal) { escritos += await this.simularRoroYVehiculos(p, base, terminales, patios, dtH, ahoraMs); modulos.add('suelta'); }
    if (!sueltaReal) { escritos += await this.simularCargaSuelta(p, base, ahoraMs); modulos.add('suelta'); }
    if (!capacidadReal) { escritos += await this.simularCapacidad(p, base, ahoraMs); modulos.add('capacidad'); }

    for (const modulo of modulos) this.avisar('tablero-actualizado', { modulo, puerto: p.clave, simulado: true }, salaPuerto(p.clave, modulo));
    return escritos;
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
