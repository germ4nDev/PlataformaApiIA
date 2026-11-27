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
        noticias     Noticias.tablero(puerto) (CC-320: TRM, titulares, vías y clima)
        gnl          GnlTelemetria.serieHistorial(puerto, 24) (CC-281: volumen por hora, presión, alarmas; hoy simulado)
                     + ultima: GnlTelemetria.ultimaLectura(puerto) (CC-316: la lectura viva que pintan las tarjetas)
      CC-281: capacidad suma la ocupación máxima, los nodos en atención y la espera máxima (de nodos[]); GNL entra a la foto.
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

/** CC-281 · El máximo de un campo numérico de los nodos de capacidad (null si ninguno tiene dato). */
const maxNodos = (campo) => (f) => {
  const v = (Array.isArray(f?.nodos) ? f.nodos : []).map((n) => aNumero(n[campo])).filter((x) => x !== null);
  return v.length ? Math.max(...v) : null;
};
/** CC-281 · GNL: solo con lecturas en la ventana (filas > 0); si no, null (dato honesto, no 0). */
const gnl = (fn) => (f) => (f && Number(f.filas) > 0 ? fn(f) : null);
/** CC-316 · Un campo de la última lectura viva de GNL (fuente.ultima); sin lectura reciente, null. */
const vivo = (campo) => (f) => (f?.ultima ? aNumero(f.ultima[campo]) : null);
const sumaSerie = (l) => (Array.isArray(l) ? Math.round(l.reduce((a, b) => a + (Number(b) || 0), 0) * 100) / 100 : null);
const ultimoDe = (l) => (Array.isArray(l) ? [...l].reverse().find((x) => x !== null && x !== undefined && Number.isFinite(Number(x))) ?? null : null);

/** Catálogo. Agregar un KPI aquí basta para que se fotografíe, tenga señales y entre en la foto operativa. */
const CATALOGO_KPI = Object.freeze([
  // ── Marítimo (AIS + muelles) ───────────────────────────────────────────────────────────────────────
  { codigo: 'maritimo.naves_fondeadas', modulo: 'maritimo', titulo: 'Naves fondeadas', unidad: 'naves', extraer: (f) => aNumero(k(f, 'resumen', 'fondeo', 'naves')) },
  { codigo: 'maritimo.espera_fondeo_prom_min', modulo: 'maritimo', titulo: 'Espera promedio en fondeo', unidad: 'min', extraer: (f) => aNumero(k(f, 'resumen', 'fondeo', 'minutosPromedio')) },
  { codigo: 'maritimo.espera_fondeo_max_min', modulo: 'maritimo', titulo: 'Espera máxima en fondeo', unidad: 'min', extraer: (f) => aNumero(k(f, 'resumen', 'fondeo', 'minutosMaximo')) },
  { codigo: 'maritimo.naves_atracadas', modulo: 'maritimo', titulo: 'Naves atracadas', unidad: 'naves', extraer: (f) => aNumero(k(f, 'resumen', 'atracadas')) },
  { codigo: 'maritimo.naves_criticas', modulo: 'maritimo', titulo: 'Naves en estado crítico', unidad: 'naves', extraer: (f) => aNumero(k(f, 'resumen', 'criticas')) },
  { codigo: 'maritimo.ocupacion_muelles_pct', modulo: 'maritimo', titulo: 'Ocupación de muelles', unidad: '%', umbrales: SATURACION, extraer: (f) => aNumero(k(f, 'ocupacion', 'resumen', 'porcentajeOcupacion')) },
  // CC-314 (regla 30, fase 2): buques esperados en 72 h (avisos DIMAR)
  { codigo: 'maritimo.naves_esperadas_72h', modulo: 'maritimo', titulo: 'Buques esperados (72 h)', unidad: 'naves', extraer: (f) => aNumero(k(f, 'esperados', 'valor')) },
  // ── Carga del tablero Marítimo (CC-314: Supertransporte en t/día del último mes completo; camiones estimados con RNDC) ──
  { codigo: 'carga.contenedores_t_dia', modulo: 'carga', titulo: 'Contenedores por día', unidad: 't', extraer: kpiTablero('KPI_CONTENEDORES') },
  { codigo: 'carga.granel_t_dia', modulo: 'carga', titulo: 'Granel por día', unidad: 't', extraer: kpiTablero('KPI_GRANEL') },
  { codigo: 'carga.general_t_dia', modulo: 'carga', titulo: 'Carga general por día', unidad: 't', extraer: kpiTablero('KPI_CARGA_SUELTA') },
  { codigo: 'carga.camiones_zona_portuaria', modulo: 'carga', titulo: 'Camiones en la zona portuaria (estimado)', unidad: 'camiones', extraer: kpiTablero('KPI_CAMIONES_PUERTO') },
  { codigo: 'roro.buques_vehiculos', modulo: 'roro', titulo: 'Buques Ro-Ro en el line-up', unidad: 'naves', extraer: kpiTablero('KPI_RORO') },
  // ── Virtual Gate ──────────────────────────────────────────────────────────────────────────────────
  { codigo: 'gate.citas_total', modulo: 'gate', titulo: 'Citas de la ventana', unidad: 'citas', extraer: (f) => aNumero(k(f, 'estadoCitas', 'totalCitas')) },
  { codigo: 'gate.en_cola', modulo: 'gate', titulo: 'Camiones en cola', unidad: 'camiones', extraer: (f) => aNumero(k(f, 'estadoCitas', 'enCola')) },
  { codigo: 'gate.retrasadas', modulo: 'gate', titulo: 'Citas retrasadas', unidad: 'citas', extraer: (f) => aNumero(k(f, 'estadoCitas', 'retrasadas')) },
  { codigo: 'gate.espera_prom_min', modulo: 'gate', titulo: 'Espera promedio en gate', unidad: 'min', umbrales: { ...UMBRALES_ESPERA, sentido: 'alto' }, extraer: (f) => aNumero(k(f, 'estadoCitas', 'esperaPromedioMin')) },
  { codigo: 'gate.cumplimiento_pct', modulo: 'gate', titulo: 'Cumplimiento de citas', unidad: '%', extraer: (f) => aNumero(k(f, 'estadoCitas', 'cumplimientoPct')) },
  { codigo: 'gate.retenidos', modulo: 'gate', titulo: 'Camiones retenidos en validación', unidad: 'camiones', extraer: (f) => aNumero(k(f, 'validacion', 'retenidos')) },
  { codigo: 'gate.aprobacion_pct', modulo: 'gate', titulo: 'Aprobación de validaciones', unidad: '%', extraer: (f) => aNumero(k(f, 'validacion', 'tasaAprobacionPct')) },
  { codigo: 'gate.alertas_criticas', modulo: 'gate', titulo: 'Alertas críticas del gate', unidad: 'alertas', extraer: (f) => aNumero(k(f, 'alertasCriticas')) },
  // CC-315 (regla 30, fase 3): las tarjetas del Virtual Gate (resumen de utils/virtual-gate.resumenKpis, ventana de 48 h)
  { codigo: 'gate.camiones_activos', modulo: 'gate', titulo: 'Camiones en gate', unidad: 'camiones', extraer: (f) => aNumero(k(f, 'resumen', 'totalCamiones')) },
  { codigo: 'gate.citas_contenedor_48h', modulo: 'gate', titulo: 'Citas de contenedores (48 h)', unidad: 'citas', extraer: (f) => aNumero(k(f, 'resumen', 'totalContenedores')) },
  { codigo: 'gate.granel_t', modulo: 'gate', titulo: 'Granel pesado en gate', unidad: 't', extraer: (f) => aNumero(k(f, 'resumen', 'totalGranel')) },
  { codigo: 'gate.suelta_t', modulo: 'gate', titulo: 'Carga suelta pesada en gate', unidad: 't', extraer: (f) => aNumero(k(f, 'resumen', 'totalCargaSuelta')) },
  { codigo: 'gate.citas_roro_48h', modulo: 'gate', titulo: 'Citas de vehículos Ro-Ro (48 h)', unidad: 'citas', extraer: (f) => aNumero(k(f, 'resumen', 'totalRoro')) },
  { codigo: 'gate.camiones_contenedor_activos', modulo: 'gate', titulo: 'Camiones de contenedor activos', unidad: 'camiones', extraer: (f) => aNumero(k(f, 'resumen', 'subContenedores')) },
  { codigo: 'gate.camiones_granel_activos', modulo: 'gate', titulo: 'Camiones de granel activos', unidad: 'camiones', extraer: (f) => aNumero(k(f, 'resumen', 'subGranel')) },
  { codigo: 'gate.camiones_suelta_activos', modulo: 'gate', titulo: 'Camiones de carga suelta activos', unidad: 'camiones', extraer: (f) => aNumero(k(f, 'resumen', 'subCargaSuelta')) },
  { codigo: 'gate.camiones_roro_activos', modulo: 'gate', titulo: 'Niñeras y vehículos Ro-Ro activos', unidad: 'camiones', extraer: (f) => aNumero(k(f, 'resumen', 'subNineras')) },
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
  // CC-319 (regla 30, fase 5): lo que ya calculan los tableros de Granel, Carga suelta y Capacidad
  { codigo: 'granel.equipos_en_uso', modulo: 'granel', titulo: 'Equipos de granel en uso', unidad: 'equipos', extraer: kpiTablero('PTT_GRA_KPI_EQUIPOS') },   // «3/8» → 3
  { codigo: 'suelta.project_cargo_folios', modulo: 'suelta', titulo: 'Project cargo activo', unidad: 'folios', extraer: kpiTablero('PTT_SUE_KPI_PROYECTO') },
  { codigo: 'capacidad.nodos_monitoreados', modulo: 'capacidad', titulo: 'Nodos de capacidad monitoreados', unidad: 'nodos', extraer: kpiTablero('PTT_CAP_KPI_NODOS') },
  { codigo: 'capacidad.capacidad_teu', modulo: 'capacidad', titulo: 'Capacidad declarada de contenedores', unidad: 'TEU', extraer: kpiTablero('PTT_CAP_KPI_TEU') },
  { codigo: 'capacidad.capacidad_t', modulo: 'capacidad', titulo: 'Capacidad declarada de granel y carga suelta', unidad: 't', extraer: kpiTablero('PTT_CAP_KPI_TON') },
  { codigo: 'capacidad.nodos_criticos', modulo: 'capacidad', titulo: 'Nodos de capacidad críticos', unidad: 'nodos', extraer: kpiTablero('PTT_CAP_KPI_CRITICOS') },
  // CC-281: lo que Capacidad ya calcula por nodo (utils/capacidad.js → nodos[]); sin nodos con dato, null
  { codigo: 'capacidad.ocupacion_max_pct', modulo: 'capacidad', titulo: 'Ocupación del nodo más lleno', unidad: '%', umbrales: SATURACION, extraer: maxNodos('ocupacionPct') },
  { codigo: 'capacidad.nodos_atencion', modulo: 'capacidad', titulo: 'Nodos de capacidad en atención', unidad: 'nodos', extraer: (f) => (Array.isArray(f?.nodos) ? f.nodos.filter((n) => n.estado === 'ATENCIÓN').length : null) },
  { codigo: 'capacidad.espera_max_min', modulo: 'capacidad', titulo: 'Espera máxima en nodos', unidad: 'min', extraer: maxNodos('esperaMin') },
  // ── Corredores viales ─────────────────────────────────────────────────────────────────────────────
  { codigo: 'viales.eventos_vigentes', modulo: 'viales', titulo: 'Eventos viales vigentes', unidad: 'eventos', extraer: contar(() => true) },
  { codigo: 'viales.cierres', modulo: 'viales', titulo: 'Cierres viales', unidad: 'eventos', extraer: contar((e) => String(e.tipoEvento).toUpperCase() === 'CIERRE_VIAL') },
  { codigo: 'viales.accidentes', modulo: 'viales', titulo: 'Accidentes y varados', unidad: 'eventos', extraer: contar((e) => ['ACCIDENTE', 'VEHICULO_AVERIADO'].includes(String(e.tipoEvento).toUpperCase())) },
  // ── Noticias (CC-320, regla 30 fase 6): KPI del tablero de Noticias (TRM, titulares, vías y clima; fuentes reales) ──────
  { codigo: 'noticias.trm_cop', modulo: 'noticias', titulo: 'TRM del día', unidad: 'COP', extraer: (f) => aNumero(k(f, 'kpis', 'PTT_NOT_KPI_TRM', 'valorCompleto')) },   // sin TRM el tablero pone 0: aquí queda sin dato (regla 12)
  { codigo: 'noticias.titulares_hoy', modulo: 'noticias', titulo: 'Noticias del sector hoy', unidad: 'noticias', extraer: kpiTablero('PTT_NOT_KPI_NOTICIAS') },
  { codigo: 'noticias.restricciones_viales_hoy', modulo: 'noticias', titulo: 'Restricciones viales del día', unidad: 'eventos', extraer: kpiTablero('PTT_NOT_KPI_VIAS') },
  { codigo: 'noticias.alertas_clima', modulo: 'noticias', titulo: 'Alertas climáticas activas', unidad: 'alertas', extraer: kpiTablero('PTT_NOT_KPI_CLIMA') },
  // ── GNL (CC-281; serie por hora de las últimas 24 h; sin lecturas, null) ─────────────────────────────
  { codigo: 'gnl.volumen_24h_m3', modulo: 'gnl', titulo: 'Volumen de GNL movido (24 h)', unidad: 'm³', extraer: gnl((f) => sumaSerie(f.volumenM3)) },
  { codigo: 'gnl.volumen_hora_m3', modulo: 'gnl', titulo: 'Volumen de GNL de la última hora', unidad: 'm³', extraer: gnl((f) => ultimoDe(f.volumenM3)) },
  { codigo: 'gnl.presion_psi', modulo: 'gnl', titulo: 'Presión promedio de la última lectura', unidad: 'psi', extraer: gnl((f) => ultimoDe(f.presionPsi)) },
  { codigo: 'gnl.alarmas_24h', modulo: 'gnl', titulo: 'Alarmas de GNL (24 h)', unidad: 'alarmas', extraer: gnl((f) => sumaSerie(f.alarmas)) },
  // CC-316 (regla 30, fase 4): lo mismo que pintan las tarjetas de GNL. La energía de 24 h de la serie consolidada; lo demás de la
  // «Vista General» de la última lectura viva de cada brazo (consolidadoVivo; sin pulso reciente, null)
  { codigo: 'gnl.temperatura_c', modulo: 'gnl', titulo: 'Temperatura del ducto', unidad: '°C', extraer: vivo('temp_ducto') },
  { codigo: 'gnl.energia_segundo_mmbtu', modulo: 'gnl', titulo: 'Energía transferida en el último segundo', unidad: 'MMBTU', extraer: vivo('energia_segundo_mmbtu') },
  { codigo: 'gnl.energia_24h_mmbtu', modulo: 'gnl', titulo: 'Energía transferida (24 h)', unidad: 'MMBTU', extraer: gnl((f) => sumaSerie(f.energiaMmbtu)) },
  { codigo: 'gnl.caudal_m3h', modulo: 'gnl', titulo: 'Caudal de flujo', unidad: 'm³/h', extraer: vivo('caudal_m3h') },
  { codigo: 'gnl.descarga_m3h', modulo: 'gnl', titulo: 'Descarga de buque', unidad: 'm³/h', extraer: vivo('descarga_buque') },
  { codigo: 'gnl.inyeccion_m3h', modulo: 'gnl', titulo: 'Inyección a red', unidad: 'm³/h', extraer: vivo('inyeccion') },
  { codigo: 'gnl.bog_kg_h', modulo: 'gnl', titulo: 'Gas evaporado (BOG)', unidad: 'kg/h', extraer: vivo('bog') },
  { codigo: 'gnl.poder_calorifico', modulo: 'gnl', titulo: 'Poder calorífico', unidad: 'BTU/ft³', extraer: vivo('poder_calorifico') },
  { codigo: 'gnl.tanques_ocupacion_pct', modulo: 'gnl', titulo: 'Ocupación de los tanques', unidad: '%', extraer: vivo('volumen_almacenado') },
]);

// CC-313 (regla 30): las definiciones de los KPI viven en las traducciones (familia PORTTOS.WIDGETS.SHARED.KPI_CARD_TCL.DEFINITION.*).

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
