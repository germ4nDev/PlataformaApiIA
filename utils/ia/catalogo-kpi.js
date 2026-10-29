/*
    Author: German Valencia
    Pattern: PORTTOS Core puro (AD-16) - Catálogo de KPI de la capa de IA (fase 1)
    Description: Qué KPI se fotografían cada 15 min y cómo se sacan de lo que ya devuelven los tableros.
      Sin base de datos ni red: recibe las salidas de los servicios (fuentes) y devuelve filas de foto.
      Cada KPI: codigo (estable, es su idEvidencia: 'kpi.<codigo>'), modulo, titulo, unidad, extraer(fuente),
      y si aplica umbrales { atencion, critico, sentido: 'alto' | 'bajo' } tomados de las constantes del sistema
      (UMBRALES_SATURACION de tablero-comun, UMBRALES_ESPERA del gate); no se inventan umbrales.
      Fuentes (lo que entrega el servicio de cada módulo):
        maritimo     { resumen: MaritimoVivo.resumen(), ocupacion: MaritimoVivo.ocupacion() }
        gate         VirtualGate.obtenerDashboardVirtualGate().virtualGate
        contenedores obtenerDatosContenedores()
        bodegas      Bodegas.obtenerDashboardBodegasPorPuerto()
        granel | suelta | capacidad   TablerosOperacion.granel() / cargaSuelta() / capacidad()
        viales       { eventos: EventosViales vigentes del puerto }
*/
const { UMBRALES_SATURACION } = require('../tablero-comun');
const { UMBRALES_ESPERA } = require('../virtual-gate');

const SATURACION = { atencion: UMBRALES_SATURACION?.atencion ?? 70, critico: UMBRALES_SATURACION?.critico ?? 85, sentido: 'alto' };

/** Número de un valor de tablero: 12 · '72 %' · '1.234 Ton' · '3,5 h' · '—' (null). */
function aNumero(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const m = String(v).trim().match(/-?\d[\d.,]*/);
  if (!m) return null;
  let t = m[0];
  if (/,\d{1,2}$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');      // 1.234,5 → 1234.5
  else t = t.replace(/[.,](?=\d{3}(\D|$))/g, '');                           // 1.234 / 1,234 → 1234
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const k = (fuente, ...ruta) => ruta.reduce((o, p) => (o === null || o === undefined ? undefined : o[p]), fuente);
const kpiTablero = (codigo) => (f) => aNumero(k(f, 'kpis', codigo, 'valor'));
const contar = (pred) => (f) => (Array.isArray(f?.eventos) ? f.eventos.filter(pred).length : null);

/** Catálogo. Agregar un KPI aquí basta para que se fotografíe, tenga señales y entre en la foto operativa. */
const CATALOGO_KPI = Object.freeze([
  // ── Marítimo (AIS + muelles) ───────────────────────────────────────────────────────────────────────
  { codigo: 'maritimo.naves_fondeadas', modulo: 'maritimo', titulo: 'Naves fondeadas', unidad: 'naves', extraer: (f) => aNumero(k(f, 'resumen', 'fondeo', 'naves')) },
  { codigo: 'maritimo.espera_fondeo_prom_min', modulo: 'maritimo', titulo: 'Espera promedio en fondeo', unidad: 'min', extraer: (f) => aNumero(k(f, 'resumen', 'fondeo', 'minutosPromedio')) },
  { codigo: 'maritimo.espera_fondeo_max_min', modulo: 'maritimo', titulo: 'Espera máxima en fondeo', unidad: 'min', extraer: (f) => aNumero(k(f, 'resumen', 'fondeo', 'minutosMaximo')) },
  { codigo: 'maritimo.naves_atracadas', modulo: 'maritimo', titulo: 'Naves atracadas', unidad: 'naves', extraer: (f) => aNumero(k(f, 'resumen', 'atracadas')) },
  { codigo: 'maritimo.naves_criticas', modulo: 'maritimo', titulo: 'Naves en estado crítico', unidad: 'naves', extraer: (f) => aNumero(k(f, 'resumen', 'criticas')) },
  { codigo: 'maritimo.ocupacion_muelles_pct', modulo: 'maritimo', titulo: 'Ocupación de muelles', unidad: '%', umbrales: SATURACION, extraer: (f) => aNumero(k(f, 'ocupacion', 'resumen', 'porcentajeOcupacion')) },
  // ── Virtual Gate ──────────────────────────────────────────────────────────────────────────────────
  { codigo: 'gate.citas_total', modulo: 'gate', titulo: 'Citas de la ventana', unidad: 'citas', extraer: (f) => aNumero(k(f, 'estadoCitas', 'totalCitas')) },
  { codigo: 'gate.en_cola', modulo: 'gate', titulo: 'Camiones en cola', unidad: 'camiones', extraer: (f) => aNumero(k(f, 'estadoCitas', 'enCola')) },
  { codigo: 'gate.retrasadas', modulo: 'gate', titulo: 'Citas retrasadas', unidad: 'citas', extraer: (f) => aNumero(k(f, 'estadoCitas', 'retrasadas')) },
  { codigo: 'gate.espera_prom_min', modulo: 'gate', titulo: 'Espera promedio en gate', unidad: 'min', umbrales: { ...UMBRALES_ESPERA, sentido: 'alto' }, extraer: (f) => aNumero(k(f, 'estadoCitas', 'esperaPromedioMin')) },
  { codigo: 'gate.cumplimiento_pct', modulo: 'gate', titulo: 'Cumplimiento de citas', unidad: '%', extraer: (f) => aNumero(k(f, 'estadoCitas', 'cumplimientoPct')) },
  { codigo: 'gate.retenidos', modulo: 'gate', titulo: 'Camiones retenidos en validación', unidad: 'camiones', extraer: (f) => aNumero(k(f, 'validacion', 'retenidos')) },
  { codigo: 'gate.aprobacion_pct', modulo: 'gate', titulo: 'Aprobación de validaciones', unidad: '%', extraer: (f) => aNumero(k(f, 'validacion', 'tasaAprobacionPct')) },
  { codigo: 'gate.alertas_criticas', modulo: 'gate', titulo: 'Alertas críticas del gate', unidad: 'alertas', extraer: (f) => aNumero(k(f, 'alertasCriticas')) },
  // ── Contenedores ──────────────────────────────────────────────────────────────────────────────────
  { codigo: 'contenedores.cargados_pendientes', modulo: 'contenedores', titulo: 'Cargados pendientes de retiro', unidad: 'contenedores', extraer: (f) => aNumero(k(f, 'kpis', 'cargadosPendientes', 'valor')) },
  { codigo: 'contenedores.vacios_devolver', modulo: 'contenedores', titulo: 'Vacíos por devolver', unidad: 'contenedores', extraer: (f) => aNumero(k(f, 'kpis', 'vaciosDevolver', 'valor')) },
  { codigo: 'contenedores.reefer_activos', modulo: 'contenedores', titulo: 'Reefer conectados', unidad: 'contenedores', extraer: (f) => aNumero(k(f, 'kpis', 'reeferActivos', 'valor')) },
  { codigo: 'contenedores.free_time_vencido', modulo: 'contenedores', titulo: 'Free time vencido', unidad: 'contenedores', extraer: (f) => aNumero(k(f, 'kpis', 'freeTimeVencido', 'valor')) },
  // ── Bodegas ───────────────────────────────────────────────────────────────────────────────────────
  { codigo: 'bodegas.ocupacion_pct', modulo: 'bodegas', titulo: 'Ocupación de bodegas', unidad: '%', umbrales: SATURACION, extraer: (f) => aNumero(k(f, 'kpis', 'ocupacionGeneral', 'valor')) },
  { codigo: 'bodegas.inventario_t', modulo: 'bodegas', titulo: 'Inventario almacenado', unidad: 't', extraer: (f) => aNumero(k(f, 'kpis', 'inventarioTotal', 'valor')) },
  { codigo: 'bodegas.flujo_24h_t', modulo: 'bodegas', titulo: 'Flujo de bodegas (24 h)', unidad: 't', extraer: (f) => aNumero(k(f, 'kpis', 'tasaDespacho', 'valor')) },
  { codigo: 'bodegas.en_alerta', modulo: 'bodegas', titulo: 'Bodegas en alerta', unidad: 'bodegas', extraer: (f) => aNumero(k(f, 'kpis', 'alertasBodega', 'valor')) },
  // ── Granel, carga suelta y capacidad ──────────────────────────────────────────────────────────────
  { codigo: 'granel.agricola_t', modulo: 'granel', titulo: 'Granel agrícola movido (24 h)', unidad: 't', extraer: kpiTablero('PTT_GRA_KPI_AGRICOLA') },
  { codigo: 'granel.mineral_t', modulo: 'granel', titulo: 'Granel mineral movido (24 h)', unidad: 't', extraer: kpiTablero('PTT_GRA_KPI_MINERAL') },
  { codigo: 'granel.liquido_t', modulo: 'granel', titulo: 'Granel líquido movido (24 h)', unidad: 't', extraer: kpiTablero('PTT_GRA_KPI_LIQUIDO') },
  { codigo: 'suelta.breakbulk_t', modulo: 'suelta', titulo: 'Break-bulk movido (24 h)', unidad: 't', extraer: kpiTablero('PTT_SUE_KPI_BREAKBULK') },
  { codigo: 'suelta.vehiculos_import', modulo: 'suelta', titulo: 'Vehículos importados', unidad: 'uds', extraer: kpiTablero('PTT_SUE_KPI_VEH_IMPORT') },
  { codigo: 'suelta.vehiculos_export', modulo: 'suelta', titulo: 'Vehículos de exportación', unidad: 'uds', extraer: kpiTablero('PTT_SUE_KPI_VEH_EXPORT') },
  { codigo: 'capacidad.nodos_criticos', modulo: 'capacidad', titulo: 'Nodos de capacidad críticos', unidad: 'nodos', extraer: kpiTablero('PTT_CAP_KPI_CRITICOS') },
  // ── Corredores viales ─────────────────────────────────────────────────────────────────────────────
  { codigo: 'viales.eventos_vigentes', modulo: 'viales', titulo: 'Eventos viales vigentes', unidad: 'eventos', extraer: contar(() => true) },
  { codigo: 'viales.cierres', modulo: 'viales', titulo: 'Cierres viales', unidad: 'eventos', extraer: contar((e) => String(e.tipoEvento).toUpperCase() === 'CIERRE_VIAL') },
  { codigo: 'viales.accidentes', modulo: 'viales', titulo: 'Accidentes y varados', unidad: 'eventos', extraer: contar((e) => ['ACCIDENTE', 'VEHICULO_AVERIADO'].includes(String(e.tipoEvento).toUpperCase())) },
]);

const POR_CODIGO = new Map(CATALOGO_KPI.map((d) => [d.codigo, d]));
const MODULOS = Object.freeze([...new Set(CATALOGO_KPI.map((d) => d.modulo))]);
const idEvidenciaKpi = (codigo) => `kpi.${codigo}`;

/** ¿La fuente del módulo viene de simulador o de un valor de respaldo? (contrato origen de cada tablero) */
function marcasOrigen(fuente) {
  const o = fuente?.origen || {};
  const kpis = fuente?.kpis && typeof fuente.kpis === 'object' ? Object.values(fuente.kpis) : [];
  const simulado = !!(fuente?.simulado || o.simulado || kpis.some((x) => x?.simulado || x?.origen?.simulado));
  const esRespaldo = !!(o.esRespaldo || kpis.some((x) => x?.origen?.esRespaldo));
  return { simulado, esRespaldo };
}

/** Redondea al cuarto de hora (las fotos de un ciclo comparten fecha). */
function cuartoDeHora(fecha) {
  const ms = fecha instanceof Date ? fecha.getTime() : Date.parse(fecha);
  return new Date(ms - (ms % (15 * 60000)));
}

/**
 * Filas de foto a partir de las salidas de los servicios.
 * @param {Object<string, any>} fuentes  { modulo: salida del servicio } (falta o null = módulo sin dato)
 * @returns {Array<{puerto, modulo, codigoKpi, valor, unidad, simulado, esRespaldo, fecha}>}
 */
function extraerKpis(fuentes, puerto, ahora = new Date()) {
  const fecha = cuartoDeHora(ahora).toISOString();
  const filas = [];
  MODULOS.forEach((modulo) => {
    const fuente = fuentes?.[modulo];
    if (fuente === undefined || fuente === null) return;
    const { simulado, esRespaldo } = marcasOrigen(fuente);
    CATALOGO_KPI.filter((d) => d.modulo === modulo).forEach((d) => {
      let valor = null;
      try { valor = d.extraer(fuente); } catch { valor = null; }
      filas.push({ puerto, modulo, codigoKpi: d.codigo, valor, unidad: d.unidad, simulado, esRespaldo, fecha });
    });
  });
  return filas;
}

/** Umbrales de un KPI (los del sistema: saturación 70/85 %, espera del gate 25/45 min), o null. */
const umbralesDe = (codigo) => POR_CODIGO.get(codigo)?.umbrales || null;

module.exports = { CATALOGO_KPI, POR_CODIGO, MODULOS, aNumero, extraerKpis, marcasOrigen, cuartoDeHora, umbralesDe, idEvidenciaKpi };
