/*
    Author: German Valencia
    Pattern: PORTTOS Núcleo puro (AD-16) - Widgets de la web en la app móvil (layout del usuario o por defecto)
    Description: El tablero móvil muestra los mismos widgets que el usuario tiene en la web para esa pestaña:
      su layout guardado (dbo.PTLLayouts) o, si no tiene, el layout por defecto (dbo.PTLWidgetsMaestro inicial = 1).
      Cada código de widget de la web tiene aquí su versión para el teléfono (kpis | lista | grafica | analista | mapa),
      armada con los mismos datos que usa la web. Sin base de datos ni red.
        ordenarLayout(filas, { zonaY })      orden de lectura (y, luego x), sin duplicados; las tarjetas de terminal
                                             (TERM_SLOT_n) se vuelven una sola lista «Terminales»
        fuentesDeLayout(codigos)             qué fuentes hay que consultar
        armarWidgets({ codigos, fuentes, filas, series, nombres })
          → { widgets, soloWeb: [{ codigo, nombre }], sinDatos: [codigo] }
          Las tarjetas KPI seguidas se agrupan en un bloque (la cuadrícula de 2 columnas del teléfono).
      Un widget sin versión móvil va a soloWeb (la app lo dice); uno cuyo dato no llegó va a sinDatos y se pinta como
      tarjeta `vacio` con su título (no se inventa un valor).
*/
const { CATALOGO_KPI } = require('../ia/catalogo-kpi');
const {
  MAX_ITEMS, kpiDesdeTarjeta, kpiDesdeCatalogo, graficaDe, listaDe, minutosTexto, estadoDesdeSemaforo, estadoPorUmbral, submuestrear,
} = require('./tablero-movil');

const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const texto = (v) => (v === null || v === undefined ? '' : String(v).trim());
const norm = (c) => texto(c).toUpperCase();
const estadoPorPct = (p) => estadoPorUmbral(p, { atencion: 70, critico: 85, sentido: 'alto' });

/** Alias de la web (WIDGET_MAP / ALIAS_MARITIMO): varios códigos, un mismo widget. */
const ALIAS = Object.freeze({
  PTT_MAE_PANEL_ALERTAS: 'PTT_MAE_PANEL_REPORTES',
  PTT_MAE_TAB_MATRIZ_CARGA: 'PTT_MAE_TAB_MATRIZ',
  PTT_MAE_MATRIZ_CARGA: 'PTT_MAE_TAB_MATRIZ',
  PTT_MAE_WGT_TERMINAL: 'TERMINALES',
  WDG_TERMINALES: 'TERMINALES',
  WDG_PORT_TERMINAL_INDIVIDUAL: 'TERMINALES',
  PTT_GATE_TABLA_COLA: 'PTT_GATE_TAB_COLA',
  PTT_GATE_CHRT_10KM: 'PTT_GATE_CHRT_DIST',
  PTT_CONT_CHRT_NAVIERAS: 'PTT_CONT_CHRT_NAVIERA',
  PTT_CONT_CHRT_FLUJO: 'PTT_CONT_TAB_MOVIMIENTOS',
});

const resolver = (codigo) => {
  const c = norm(codigo);
  if (/^TERM_SLOT_\d+$/.test(c)) return 'TERMINALES';
  return ALIAS[c] || c;
};

/** KPI de la web → serie de 24 h del catálogo de la IA (para la gráfica del detalle). */
const SERIE_DE = Object.freeze({
  PTT_CONT_KPI_CARGADOS: 'contenedores.cargados_pendientes', PTT_CONT_KPI_VACIOS: 'contenedores.vacios_devolver',
  PTT_CONT_KPI_REEFER: 'contenedores.reefer_activos', PTT_CONT_KPI_FREETIME: 'contenedores.free_time_vencido',
  PTT_BOD_KPI_OCUPACION: 'bodegas.ocupacion_pct', PTT_BOD_KPI_INVENTARIO: 'bodegas.inventario_t',
  PTT_BOD_KPI_DESPACHOS: 'bodegas.flujo_24h_t', PTT_BOD_KPI_ALERTAS: 'bodegas.en_alerta',
  PTT_GRA_KPI_AGRICOLA: 'granel.agricola_t', PTT_GRA_KPI_MINERAL: 'granel.mineral_t', PTT_GRA_KPI_LIQUIDO: 'granel.liquido_t',
  PTT_SUE_KPI_BREAKBULK: 'suelta.breakbulk_t', PTT_SUE_KPI_VEH_IMPORT: 'suelta.vehiculos_import', PTT_SUE_KPI_VEH_EXPORT: 'suelta.vehiculos_export',
  PTT_CAP_KPI_CRITICOS: 'capacidad.nodos_criticos',
  PTT_MAE_KPI_FONDEO: 'maritimo.naves_fondeadas', PTT_MAE_KPI_MUELLE: 'maritimo.naves_atracadas',
  PTT_GATE_KPI_OP: 'gate.citas_total',
});

/** Foco de cada analista IA por pestaña (el mismo del widget analista-ia de la web). */
const FOCO_ANALISTA = Object.freeze({
  MARITIMO: ['saturacion_muelles', 'retraso_buque', 'riesgo_clima'],
  VIRTUAL_GATE: ['congestion_gate', 'corredor_vial'],
  GATE: ['congestion_gate', 'corredor_vial'],
  TERRESTRE: ['corredor_vial', 'congestion_gate', 'riesgo_clima'],
  CONTENEDORES: ['saturacion_almacen', 'congestion_gate', 'saturacion_muelles'],
  BODEGAS: ['saturacion_almacen'],
  GNL: ['gnl', 'riesgo_clima'],
  GRANEL: ['saturacion_muelles', 'saturacion_almacen', 'retraso_buque'],
  SUELTA: ['saturacion_muelles', 'saturacion_almacen', 'retraso_buque'],
  CAPACIDAD: ['saturacion_almacen', 'saturacion_muelles', 'congestion_gate'],
  MAPA: ['corredor_vial', 'congestion_gate', 'riesgo_clima', 'saturacion_muelles'],
});

// ------------------------------------------------------------------ piezas

/** Item de lista desde una fila cualquiera de los tableros (nombres de campo de la web). */
function itemGenerico(x) {
  if (!x || typeof x !== 'object') return null;
  const titulo = texto(x.nombre ?? x.titulo ?? x.motonave ?? x.label ?? x.terminal ?? x.placa ?? x.contenedor ?? x.codigo ?? x.brazo ?? x.corredor ?? x.puerto ?? x.producto ?? x.marca ?? x.id);
  const detalle = [x.producto, x.terminal, x.naviera, x.tipo, x.operacion, x.categoriaNombre, x.condicion, x.estado, x.detalle]
    .map(texto).filter((t) => t && t !== titulo).slice(0, 2).join(' · ');
  const pct = num(x.porcentaje ?? x.ocupacionPct ?? x.avancePct);
  const valor = pct ?? num(x.valor ?? x.total ?? x.tm ?? x.toneladas ?? x.cantidad ?? x.unidades ?? x.eventos ?? x.temperatura);
  const estado = x.semaforo ? estadoDesdeSemaforo(x.semaforo) : pct !== null ? estadoPorPct(pct) : 'neutro';
  return {
    titulo, ...(detalle ? { detalle } : {}), valor: valor ?? (typeof x.valor === 'string' ? x.valor : null),
    ...(pct !== null ? { unidad: '%', progreso: pct } : x.unidad ? { unidad: texto(x.unidad) } : {}), estado,
  };
}

const lista = (filas, meta, mapear = itemGenerico) => listaDe(filas, meta, mapear);

/** {labels, series: {nombre: valores[]}} (historicoMensual) → forma de graficaDe. */
const seriesDeObjeto = (o) => (o && o.series && !Array.isArray(o.series) && typeof o.series === 'object'
  ? { labels: o.labels, series: Object.entries(o.series).map(([nombre, valores]) => ({ nombre, valores })) } : o);

const grafica = (dato, meta) => graficaDe(seriesDeObjeto(dato), meta);

/** Bloque de un solo KPI (luego se agrupan los consecutivos). */
const unKpi = (k) => (k && k.valor !== null && k.valor !== undefined ? { tipo: 'kpis', id: k.id, titulo: '', items: [k] } : null);

/** Títulos de respaldo para tarjetas cuyo nodo del API no trae título (en la web lo pone la configuración del widget). */
const TITULO_RESPALDO = Object.freeze({
  PTT_CONT_KPI_CARGADOS: 'Cargados por retirar', PTT_CONT_KPI_VACIOS: 'Vacíos por devolver',
  PTT_CONT_KPI_REEFER: 'Reefer conectados', PTT_CONT_KPI_FREETIME: 'Free time vencido',
});

/** «PTT_CONT_KPI_FREETIME» → «Freetime»: último recurso para que nunca se vea un código como título. */
const humanizar = (codigo) => {
  const t = norm(codigo).replace(/^(PTT|WDG|TLC)_/, '').replace(/^[A-Z]{2,4}_(KPI|CHRT|PANEL|TAB|WGT)_/, '').replace(/_/g, ' ').toLowerCase();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
};

function kpiTarjeta(codigo, tarjeta, ctx) {
  // Corregido 2026-10-25: Contenedores entrega sus tarjetas sin título y el teléfono mostraba el código (PTT_CONT_KPI_…)
  const titulo = texto(tarjeta?.titulo);
  const conTitulo = tarjeta && typeof tarjeta === 'object' && (!titulo || titulo === codigo)
    ? { ...tarjeta, titulo: texto(ctx?.nombre) || TITULO_RESPALDO[codigo] || humanizar(codigo) } : tarjeta;
  const k = kpiDesdeTarjeta(codigo, conTitulo);
  if (!k) return null;
  const serie = ctx.series?.get?.(SERIE_DE[codigo]);
  if (!k.serie && serie && serie.length > 1) k.serie = submuestrear(serie.map((f) => f.valor));
  return unKpi(k);
}

/** KPI del catálogo de la IA (foto + serie). */
function kpiCatalogo(codigoKpi, ctx) {
  const def = CATALOGO_KPI.find((d) => d.codigo === codigoKpi);
  const fila = (ctx.filas || []).find((f) => f.codigoKpi === codigoKpi);
  if (!def || !fila) return null;
  const k = kpiDesdeCatalogo(def, fila, ctx.series?.get?.(codigoKpi));
  return k.valor === null ? null : k;
}

const bloqueCatalogo = (id, titulo, codigos, ctx) => {
  const items = codigos.map((c) => kpiCatalogo(c, ctx)).filter(Boolean);
  return items.length ? { tipo: 'kpis', id, titulo, items } : null;
};

/** KPI simple con valor numérico (o texto) y estado. */
const kpiSimple = (id, titulo, valor, unidad = '', extra = {}) => ({ id, titulo, valor: valor ?? null, unidad, estado: 'neutro', simulado: false, ...extra });

const bloqueKpis = (id, titulo, items) => {
  const v = items.filter((k) => k.titulo && k.valor !== null && k.valor !== undefined);
  return v.length ? { tipo: 'kpis', id, titulo, items: v } : null;
};

// ------------------------------------------------------------------ catálogo por código de la web

const W = (fuente, armar) => ({ fuente, armar });
const KPI_DE = (fuente, ruta) => W(fuente, (c) => kpiTarjeta(c.codigo, ruta(c.fuentes[fuente], c.codigo), c));

/** Tarjetas PTT_GATE_KPI_* (mismos títulos y valores que virtual-gate.service de la web). */
const GATE_KPI = {
  PTT_GATE_KPI_OP: (r) => ({ titulo: 'CAMIONES EN GATE', valor: r.totalCamiones, subtitulo: `${r.validados ?? 0} validados · ${r.enCola ?? 0} en cola`, colorBorde: 'borde-cyan' }),
  PTT_GATE_KPI_CONT: (r) => ({ titulo: 'CONTENEDORES', valor: r.totalContenedores, subtitulo: r.subtituloContenedores, colorBorde: 'borde-amarillo' }),
  PTT_GATE_KPI_GRANEL: (r) => ({ titulo: 'GRANEL (TON)', valor: r.totalGranel, unidad: 't', subtitulo: r.subtituloGranel, colorBorde: 'borde-naranja' }),
  PTT_GATE_KPI_SUELTA: (r) => ({ titulo: 'CARGA SUELTA (TON)', valor: r.totalCargaSuelta, unidad: 't', subtitulo: r.subtituloCargaSuelta, colorBorde: 'borde-green' }),
  PTT_GATE_KPI_RORO: (r) => ({ titulo: 'VEHÍCULOS RO-RO', valor: r.totalRoro, subtitulo: r.subtituloRoro, colorBorde: 'borde-teal' }),
  PTT_GATE_KPI_BODEGAS: (r) => ({ titulo: 'SATURACIÓN BODEGAS', valor: r.saturacionBodegas ?? null, subtitulo: r.subtituloBodegas, colorBorde: 'borde-purple' }),
  PTT_GATE_KPI_SUB_CONT: (r) => ({ titulo: 'CAMIONES CONTENEDOR', valor: r.subContenedores, subtitulo: 'Citas de contenedores' }),
  PTT_GATE_KPI_SUB_GRANEL: (r) => ({ titulo: 'CAMIONES GRANEL', valor: r.subGranel, subtitulo: 'Citas de granel' }),
  PTT_GATE_KPI_SUB_SUELTA: (r) => ({ titulo: 'CAMIONES CARGA SUELTA', valor: r.subCargaSuelta, subtitulo: 'Citas de carga suelta' }),
  PTT_GATE_KPI_SUB_NINERAS: (r) => ({ titulo: 'NIÑERAS / RO-RO', valor: r.subNineras, subtitulo: 'Citas de vehículos' }),
};

const CONT_KPI = { PTT_CONT_KPI_CARGADOS: 'cargadosPendientes', PTT_CONT_KPI_VACIOS: 'vaciosDevolver', PTT_CONT_KPI_REEFER: 'reeferActivos', PTT_CONT_KPI_FREETIME: 'freeTimeVencido' };
const BOD_KPI = { PTT_BOD_KPI_OCUPACION: 'ocupacionGeneral', PTT_BOD_KPI_INVENTARIO: 'inventarioTotal', PTT_BOD_KPI_DESPACHOS: 'tasaDespacho', PTT_BOD_KPI_ALERTAS: 'alertasBodega' };

/** KPI de GNL: iguales a la web (decisión del usuario, 2026-10-25). En la web cada tarjeta (kpi-card-tcl, mapaGnlKpis) solo
 *  muestra el pulso del socket, con su propio título; el medidor de presión (gnl-gauge-widget) usa el título del layout.
 *  Aquí van [título, unidad, subtítulo]; lista espejo de KPIS_GNL_VIVO en PorttosMovil/src/app/nucleo/gnl.ts (hay prueba). */
const GNL_VIVO = Object.freeze({
  PTT_GNL_KPI_FLUJO: ['Caudal de flujo', 'm³/h'], PTT_GNL_KPI_PRESION: ['Presión', 'psi'],
  PTT_GNL_GAUGE_PRESION: ['Presión de línea', 'psi', 'Telemetría SCADA'], PTT_GNL_KPI_TEMP: ['Temperatura', '°C'],
  PTT_GNL_KPI_BOG: ['BOG', 'kg/h', 'Gas evaporado / Boil-off'], PTT_GNL_KPI_DESCARGA: ['Descarga de buque', 'm³/h', 'Telemetría de entrada'],
  PTT_GNL_KPI_INYECCION: ['Inyección a red', 'm³/h', 'Flujo de salida a red'],
  PTT_GNL_KPI_TNQ_OCUP: ['Ocupación de planta', '%', 'Porcentaje de llenado de tanques'],
  PTT_GNL_KPI_VOLUMEN: ['Energía transferida', 'MMBTU', 'Energía del último segundo'],
  PTT_GNL_KPI_CALIDAD: ['Poder calorífico', 'BTU/ft³', 'Calidad de la mezcla GNL'], PTT_GNL_KPI_CALORIFICO: ['Poder calorífico', 'BTU/ft³'],
  PTT_GNL_KPI_ALERTAS: ['Alarmas activas', ''], PTT_GNL_KPI_ODO_MMBTU: ['Energía acumulada', 'MMBTU', 'Desde que se abrió el tablero'],
});

/** Gráficas de GNL que la app dibuja con el componente de la web (OT-005): [título y subtítulo por defecto de la web]. */
const GNL_COMPONENTES = Object.freeze({
  PTT_GNL_GAUGE_PRESION: ['Presión de Línea', 'Telemetría SCADA'],
  PTT_GNL_LINECHART_FLUJO: ['Histórico de Flujo (m³/h)', 'Caudal de GNL en tiempo real (SCADA)'],
  PTT_GNL_CHART_SPK_TEMP: ['Temperatura Criogénica', 'Tendencia térmica en tiempo real'],
});

/** Tarjeta GNL sin valor todavía: la app la llena con el primer pulso del socket (no se inventa un valor; la web muestra
 *  «cargando» hasta ese pulso). */
const kpiEsperandoGnl = (cod, c) => {
  const [titulo, unidad, subtitulo] = GNL_VIVO[cod];
  return {
    tipo: 'kpis', id: cod, titulo: '',
    items: [{
      id: cod, titulo: cod === 'PTT_GNL_GAUGE_PRESION' ? texto(c.nombre) || titulo : titulo, valor: null, unidad,
      ...(subtitulo ? { subtitulo } : {}), estado: 'neutro', simulado: false, vivo: 'gnl',
    }],
  };
};

const KPI_MARITIMO = ['PTT_MAE_KPI_CAMIONES', 'PTT_MAE_KPI_CONTENEDORES', 'PTT_MAE_KPI_GRANEL', 'PTT_MAE_KPI_CARGA_SUELTA', 'PTT_MAE_KPI_RORO',
  'PTT_MAE_KPI_BODEGAS', 'PTT_MAE_KPI_ESPERADOS', 'PTT_MAE_KPI_FONDEO', 'PTT_MAE_KPI_MUELLE', 'PTT_MAE_KPI_MOTONAVES', 'PTT_MAE_KPI_VOLUMEN',
  'PTT_MAE_KPI_CAMIONES_VIA', 'PTT_MAE_KPI_CAMIONES_CARGA', 'PTT_MAE_KPI_CAMIONES_PUERTO'];

const R = (c) => c.fuentes.maritimoResumen;

const CATALOGO = {
  // ---------------- Marítimo: resumen operativo de la web (/maritimo/resumen) y AIS en vivo
  ...Object.fromEntries(KPI_MARITIMO.map((c) => [c, KPI_DE('maritimoResumen', (r, cod) => r[cod])])),
  TERMINALES: W('maritimoResumen', (c) => lista(R(c).WDG_TERMINALES, { id: 'TERMINALES', titulo: 'Terminales', subtitulo: 'Ocupación de muelles por terminal' }, (t) => {
    const p = num(String(t.kpis?.ocupacion ?? t.kpis?.occupancy ?? '').replace('%', ''));
    const detalle = [texto(t.badgeCount) ? `${t.badgeCount} muelles` : '', texto(t.kpis?.metricValue) ? `${t.kpis.metricValue} ${texto(t.kpis.metricLabel)}`.trim() : ''].filter(Boolean).join(' · ');
    return { titulo: texto(t.title || t.nombre || t.name), detalle, valor: p, unidad: '%', progreso: p, estado: estadoPorPct(p) };
  })),
  PTT_MAE_TAB_MOTONAVES: W('maritimoResumen', (c) => lista(R(c).PTT_MAE_TAB_MOTONAVES?.motonaves, { id: c.codigo, titulo: c.nombre || 'Motonaves' }, (m) => ({
    titulo: texto(m.motonave), detalle: [texto(m.terminal), texto(m.carga)].filter((t) => t && t !== 'ND').join(' · '),
    valor: texto(m.estadoTexto) || (m.eta ? `ETA ${m.eta}` : ''), estado: m.atrasada ? 'atencion' : 'neutro',
  }))),
  PTT_MAE_CHRT_ETA_ATA: W('maritimoResumen', (c) => grafica(R(c).PTT_MAE_CHRT_ETA_ATA, { id: c.codigo, titulo: c.nombre || 'ETA vs ATA', forma: 'barras' })),
  PTT_MAE_CHRT_TONELADAS: W('maritimoResumen', (c) => grafica(R(c).PTT_MAE_CHRT_TONELADAS, { id: c.codigo, titulo: c.nombre || 'Toneladas', forma: 'barras', unidad: 't' })),
  PTT_MAE_CHRT_PROD: W('maritimoResumen', (c) => grafica(R(c).PTT_MAE_CHRT_PROD, { id: c.codigo, titulo: c.nombre || 'Productividad', forma: 'barras', unidad: 'movs/h' })),
  PTT_MAE_CHRT_PART_TERM: W('maritimoResumen', (c) => grafica(R(c).PTT_MAE_CHRT_PART_TERM, { id: c.codigo, titulo: c.nombre || 'Participación nacional', forma: 'dona' })),
  PTT_MAE_CHRT_MEZCLA: W('maritimoResumen', (c) => grafica(R(c).PTT_MAE_CHRT_MEZCLA, { id: c.codigo, titulo: c.nombre || 'Mezcla de carga', forma: 'dona', unidad: 't' })),
  PTT_MAE_CHRT_TIPO_OP: W('maritimoResumen', (c) => grafica(R(c).PTT_MAE_CHRT_TIPO_OP, { id: c.codigo, titulo: c.nombre || 'Tipo de operación', forma: 'dona', unidad: 't' })),
  PTT_MAE_CHRT_HISTORICO: W('maritimoResumen', (c) => grafica(R(c).PTT_MAE_CHRT_HISTORICO, { id: c.codigo, titulo: c.nombre || 'Histórico anual', forma: 'linea', unidad: 't' })),
  PTT_MAE_PANEL_CANAL: W('maritimoResumen', (c) => {
    const k = R(c).PTT_MAE_PANEL_CANAL;
    if (!k) return null;
    const v = (x) => (texto(x) && !['N/A', '--', 'Sin dato', 'Sin datos'].includes(texto(x)) ? texto(x) : null);
    const items = [['Estado del canal', k.estadoCanal], ['Marea', k.marea], ['Pleamar', k.pleamar], ['Visibilidad', k.visibilidad], ['Viento', k.viento]]
      .filter(([, x]) => v(x))
      .map(([t, x], i) => ({ titulo: t, valor: v(x), estado: i === 0 && t === 'Estado del canal' ? (x === 'Abierto' ? 'ok' : x === 'Desconocido' ? 'neutro' : 'critico') : 'neutro' }));
    return items.length ? { tipo: 'lista', id: c.codigo, titulo: c.nombre || 'Condiciones del canal', total: items.length, items } : null;
  }),
  PTT_MAE_PANEL_RESUMEN: W('maritimoResumen', (c) => {
    const m = R(c).PTT_MAE_PANEL_RESUMEN?.metricas;
    return bloqueKpis(c.codigo, c.nombre || 'Resumen semanal', (Array.isArray(m) ? m : []).map((x, i) => kpiSimple(`${c.codigo}.${i}`, texto(x.label), texto(x.valor) || null)));
  }),
  PTT_MAE_PANEL_REPORTES: W('maritimoResumen', (c) => lista(R(c).PTT_MAE_PANEL_REPORTES?.reportes, { id: c.codigo, titulo: c.nombre || 'Reportes operativos' }, (r) => ({
    titulo: texto(r.titulo), detalle: texto(r.descripcion), valor: texto(r.fecha_evento), estado: 'neutro',
  }))),
  PTT_MAE_PANEL_TRAFICO: W('maritimoResumen', (c) => {
    const top = R(c).PTT_MAE_PANEL_TRAFICO?.kpisTop || {};
    return bloqueKpis(c.codigo, c.nombre || 'Tráfico portuario', [['toneladas', 'Toneladas del año'], ['variacion', 'Variación anual'], ['flujo', 'Flujo']]
      .filter(([k]) => texto(top[k]?.valor) && texto(top[k]?.valor) !== '—')
      .map(([k, titulo]) => kpiSimple(`${c.codigo}.${k}`, titulo, texto(top[k].valor), '', { subtitulo: texto(top[k].detalle) || undefined })));
  }),
  PTT_MAE_PANEL_IMPLICACIONES: W('maritimoResumen', (c) => lista(R(c).PTT_MAE_PANEL_IMPLICACIONES?.insights, { id: c.codigo, titulo: c.nombre || 'Implicaciones operativas' }, (x) => ({
    titulo: texto(x.titulo), detalle: texto(x.descripcion), estado: 'neutro',
  }))),
  PTT_MAE_TAB_MATRIZ: W('maritimoResumen', (c) => lista(
    [...(R(c).PTT_MAE_TAB_MATRIZ?.filas || [])].sort((a, b) => (num(b.total) || 0) - (num(a.total) || 0)),
    { id: c.codigo, titulo: c.nombre || 'Matriz terminal / carga', subtitulo: 'Toneladas por terminal' },
    (f) => ({
      titulo: texto(f.terminal), detalle: [['cont', 'Cont.'], ['solido', 'Sólido'], ['general', 'General'], ['liquido', 'Líquido'], ['carbon', 'Carbón']].filter(([k]) => num(f[k]) > 0).map(([, n]) => n).join(' · '),
      valor: num(f.total), unidad: 't', estado: 'neutro',
    }),
  )),
  PTT_MAE_VIVO_KPIS: W('maritimo', (c) => bloqueCatalogo(c.codigo, c.nombre || 'Bahía en vivo', ['maritimo.naves_fondeadas', 'maritimo.naves_atracadas', 'maritimo.ocupacion_muelles_pct', 'maritimo.naves_criticas'], c)),
  PTT_MAE_VIVO_TIEMPOS: W('maritimo', (c) => bloqueCatalogo(c.codigo, c.nombre || 'Tiempos de espera', ['maritimo.espera_fondeo_prom_min', 'maritimo.espera_fondeo_max_min'], c)),
  PTT_MAE_VIVO_COLA_FONDEO: W('maritimo', (c) => lista(c.fuentes.maritimo.resumen?.fondeo?.cola, { id: c.codigo, titulo: c.nombre || 'Cola de fondeo', subtitulo: 'Naves esperando, la más antigua primero' }, (n) => ({
    titulo: texto(n.nombre || n.mmsi), detalle: texto(n.destino), valor: minutosTexto(n.minutos),
    estado: num(n.minutos) >= 1440 ? 'critico' : num(n.minutos) >= 480 ? 'atencion' : 'neutro',
  }))),
  PTT_MAE_VIVO_MUELLES: W('maritimo', (c) => {
    const o = c.fuentes.maritimo.ocupacion;
    return o?.terminales?.length ? grafica({
      labels: o.terminales.map((t) => t.nombre),
      series: [{ nombre: 'Ocupados', valores: o.terminales.map((t) => (t.muelles || []).filter((x) => x.ocupado).length) },
        { nombre: 'Libres', valores: o.terminales.map((t) => (t.muelles || []).filter((x) => !x.ocupado && !x.enMantenimiento).length) }],
    }, { id: c.codigo, titulo: c.nombre || 'Muelles por terminal', forma: 'barras', unidad: 'muelles' }) : null;
  }),
  PTT_MAE_VIVO_LLEGADAS: W('llegadas', (c) => lista(c.fuentes.llegadas.naves, { id: c.codigo, titulo: c.nombre || 'Próximas llegadas', subtitulo: 'Line-up de las próximas 72 h' }, (n) => ({
    titulo: texto(n.motonave), detalle: [texto(n.instalacion), texto(n.agencia)].filter(Boolean).join(' · '),
    valor: num(n.minutosParaEta) !== null ? (n.minutosParaEta <= 0 ? 'En puerto' : `ETA ${minutosTexto(n.minutosParaEta)}`) : texto(n.situacion), estado: 'neutro',
  }))),

  // ---------------- Virtual Gate
  ...Object.fromEntries(Object.entries(GATE_KPI).map(([cod, f]) => [cod, W('gate', (c) => kpiTarjeta(cod, f(c.fuentes.gate.resumen || {}), c))])),
  PTT_GATE_PANEL_ESTADO: W('gate', (c) => {
    const e = c.fuentes.gate.estadoCitas;
    if (!e) return null;
    const esp = num(e.esperaPromedioMin);
    return bloqueKpis(c.codigo, c.nombre || 'Estado de citas', [
      kpiSimple(`${c.codigo}.total`, 'Citas', num(e.totalCitas), 'citas'),
      kpiSimple(`${c.codigo}.cola`, 'En cola', num(e.enCola), 'camiones'),
      kpiSimple(`${c.codigo}.retrasadas`, 'Retrasadas', num(e.retrasadas), 'citas', { estado: num(e.retrasadas) > 0 ? 'atencion' : 'ok' }),
      kpiSimple(`${c.codigo}.cumplimiento`, 'Cumplimiento', num(e.cumplimientoPct), '%'),
      kpiSimple(`${c.codigo}.espera`, 'Espera promedio', esp, 'min', { estado: e.umbrales ? estadoPorUmbral(esp, { ...e.umbrales, sentido: 'alto' }) : 'neutro' }),
    ]);
  }),
  PTT_GATE_PANEL_VAL: W('gate', (c) => {
    const v = c.fuentes.gate.validacion;
    if (!v) return null;
    return bloqueKpis(c.codigo, c.nombre || 'Validación pre-gate', [
      kpiSimple(`${c.codigo}.listos`, 'Listos para ingreso', num(v.listosIngreso), 'camiones', { estado: 'ok' }),
      kpiSimple(`${c.codigo}.observados`, 'Observados', num(v.observados), 'camiones', { estado: num(v.observados) > 0 ? 'atencion' : 'ok' }),
      kpiSimple(`${c.codigo}.sinDato`, 'Sin dato', num(v.sinDato), 'camiones'),
      kpiSimple(`${c.codigo}.aprobacion`, 'Aprobación', num(v.tasaAprobacionPct), '%'),
    ]);
  }),
  PTT_GATE_PANEL_ALERTAS: W('gate', (c) => lista(c.fuentes.gate.alertas?.lista || c.fuentes.gate.alertas, { id: c.codigo, titulo: c.nombre || 'Esperas excedidas' }, (a) => ({
    titulo: texto(a.placa) || texto(a.tipo), detalle: texto(a.terminal), valor: minutosTexto(a.minutos), estado: estadoDesdeSemaforo(a.severidad),
  }))),
  PTT_GATE_CHRT_DIST: W('gate', (c) => grafica(c.fuentes.gate.distribucion10km, { id: c.codigo, titulo: c.nombre || 'Distribución en 10 km', forma: 'barras', unidad: 'camiones' })),
  PTT_GATE_CHRT_CITAS: W('gate', (c) => grafica(c.fuentes.gate.citas12h, { id: c.codigo, titulo: c.nombre || 'Citas próximas 12 h', forma: 'barras', unidad: 'citas' })),
  PTT_GATE_TAB_COLA: W('gate', (c) => lista(
    [...(c.fuentes.gate.citas || [])].filter((x) => !['FINALIZADA', 'ATENDIDA', 'CANCELADA', 'SALIDA'].includes(texto(x.estado)))
      .sort((a, b) => (num(b.tiempo_espera_minutos) || 0) - (num(a.tiempo_espera_minutos) || 0)),
    { id: c.codigo, titulo: c.nombre || 'Cola del gate', subtitulo: 'Mayor espera primero' },
    (x) => ({ titulo: texto(x.placa) || texto(x.id_cita), detalle: [texto(x.terminal), texto(x.tipo_carga), texto(x.estado)].filter(Boolean).join(' · '), valor: minutosTexto(x.tiempo_espera_minutos), estado: 'neutro' }),
  )),

  // ---------------- Contenedores
  ...Object.fromEntries(Object.entries(CONT_KPI).map(([cod, k]) => [cod, KPI_DE('contenedores', (f) => f.kpis?.[k])])),
  PTT_CONT_CHRT_RETIROS: W('contenedores', (c) => grafica(c.fuentes.contenedores.retirosPriorizacion, { id: c.codigo, titulo: c.nombre || 'Retiros por día', forma: 'barras', unidad: 'contenedores' })),
  PTT_CONT_CHRT_NAVIERA: W('contenedores', (c) => grafica(c.fuentes.contenedores.vaciosNaviera, { id: c.codigo, titulo: c.nombre || 'Vacíos por naviera', forma: 'barras', unidad: 'contenedores' })),
  PTT_CONT_CHRT_FREETIME: W('contenedores', (c) => grafica(c.fuentes.contenedores.freeTimeDistribucion, { id: c.codigo, titulo: c.nombre || 'Free time', forma: 'barras', unidad: 'contenedores' })),
  PTT_CONT_PANEL_PATIOS: W('contenedores', (c) => lista(c.fuentes.contenedores.saturacionPatios, { id: c.codigo, titulo: c.nombre || 'Saturación de patios' })),
  PTT_CONT_TAB_MOVIMIENTOS: W('contenedores', (c) => lista(c.fuentes.contenedores.movimientos, { id: c.codigo, titulo: c.nombre || 'Movimientos' }, (m) => ({
    titulo: texto(m.contenedor), detalle: [texto(m.operacion), texto(m.naviera), texto(m.tipo)].filter(Boolean).join(' · '), valor: texto(m.estado), estado: 'neutro',
  }))),

  // ---------------- Bodegas
  ...Object.fromEntries(Object.entries(BOD_KPI).map(([cod, k]) => [cod, KPI_DE('bodegas', (f) => f.kpis?.[k])])),
  PTT_BOD_PANEL_SATURACION: W('bodegas', (c) => lista(c.fuentes.bodegas.saturacionBodegas, { id: c.codigo, titulo: c.nombre || 'Ocupación de bodegas', subtitulo: 'Las más llenas primero' }, (x) => {
    const p = num(x.ocupacionPct ?? x.porcentaje);
    return { titulo: texto(x.nombre || x.codigo), valor: p, unidad: '%', progreso: p, estado: estadoPorPct(p) };
  })),
  PTT_BOD_CHRT_FLUJO: W('bodegas', (c) => grafica(c.fuentes.bodegas.flujoEntradasSalidas, { id: c.codigo, titulo: c.nombre || 'Entradas y salidas', forma: 'barras', unidad: 't' })),
  PTT_BOD_CHRT_CARGA: W('bodegas', (c) => grafica(c.fuentes.bodegas.distribucionPorCarga, { id: c.codigo, titulo: c.nombre || 'Inventario por tipo de carga', forma: 'dona', unidad: 't' })),
  PTT_BOD_TAB_MOVIMIENTOS: W('bodegas', (c) => lista(c.fuentes.bodegas.movimientosBodega, { id: c.codigo, titulo: c.nombre || 'Movimientos de bodega' }, (m) => ({
    titulo: texto(m.nombre_bodega || m.bodega || m.codigo_bodega || m.id_movimiento),
    detalle: [texto(m.tipo_movimiento || m.tipo), texto(m.tipo_carga || m.producto)].filter(Boolean).join(' · '),
    valor: num(m.toneladas ?? m.cantidad_ton ?? m.cantidad), unidad: 't', estado: 'neutro',
  }))),

  // ---------------- GNL
  // KPI: solo en vivo, como la web (sin historial de punto de partida). Las gráficas de abajo sí usan el historial.
  ...Object.fromEntries(Object.keys(GNL_VIVO).map((cod) => [cod, W(null, (c) => kpiEsperandoGnl(cod, c))])),
  // Tacómetro, histórico de flujo y temperatura: la app los dibuja con sus componentes, iguales a los de la web, y toma los
  // datos del socket y del historial (OT-005). Aquí solo van los textos (los de la web si el layout no trae nombre).
  ...Object.fromEntries(Object.entries(GNL_COMPONENTES).map(([cod, [titulo, subtitulo]]) => [cod, W(null, (c) => ({
    tipo: 'componente', id: c.codigo, codigo: c.codigo, titulo: texto(c.nombre) || titulo, subtitulo,
  }))])),
  PTT_GNL_CHART_ALM_EVENT: W('gnl', (c) => (Array.isArray(c.fuentes.gnl.alarmas)
    ? grafica({ labels: c.fuentes.gnl.labels, valores: c.fuentes.gnl.alarmas }, { id: c.codigo, titulo: c.nombre || 'Alarmas por hora', forma: 'barras', unidad: 'alarmas' }) : null)),

  // ---------------- Granel · Carga suelta · Capacidad · Noticias (tableros /api/tableros; sus KPI vienen con el código)
  PTT_GRA_TAB_MOTONAVES: W('granel', (c) => lista(c.fuentes.granel.motonaves, { id: c.codigo, titulo: c.nombre || 'Motonaves de granel' }, (m) => ({
    titulo: texto(m.motonave), detalle: [texto(m.terminal), texto(m.producto)].filter(Boolean).join(' · '), valor: num(m.avancePct), unidad: '%', progreso: num(m.avancePct), estado: 'neutro',
  }))),
  PTT_GRA_CHRT_PRODUCTO: W('granel', (c) => grafica(c.fuentes.granel.productos, { id: c.codigo, titulo: c.nombre || 'Por producto', forma: 'dona', unidad: 't' })),
  PTT_GRA_TAB_EQUIPOS: W('granel', (c) => lista(c.fuentes.granel.equipos, { id: c.codigo, titulo: c.nombre || 'Equipos' }, (e) => ({
    titulo: texto(e.codigo), detalle: [texto(e.tipo), texto(e.motonave), texto(e.estado)].filter(Boolean).join(' · '), valor: num(e.rendimientoTmh), unidad: 't/h', estado: 'neutro',
  }))),
  PTT_GRA_PANEL_BODEGAS: W('granel', (c) => lista(c.fuentes.granel.bodegas, { id: c.codigo, titulo: c.nombre || 'Bodegas y silos de granel' })),
  PTT_GRA_CHRT_TENDENCIA: W('granel', (c) => grafica(c.fuentes.granel.tendencia, { id: c.codigo, titulo: c.nombre || 'Movimiento por hora (24 h)', forma: 'linea', unidad: 't' })),
  PTT_GRA_CHRT_HISTORICO: W('granel', (c) => grafica(c.fuentes.granel.historico, { id: c.codigo, titulo: c.nombre || 'Histórico mensual', forma: 'linea', unidad: 't' })),
  PTT_SUE_TAB_BREAKBULK: W('suelta', (c) => lista(c.fuentes.suelta.breakBulk, { id: c.codigo, titulo: c.nombre || 'Break-bulk' })),
  PTT_SUE_TAB_PROYECTO: W('suelta', (c) => lista(c.fuentes.suelta.proyecto, { id: c.codigo, titulo: c.nombre || 'Project cargo' })),
  PTT_SUE_CHRT_COMPOSICION: W('suelta', (c) => grafica(c.fuentes.suelta.composicion, { id: c.codigo, titulo: c.nombre || 'Composición de la carga', forma: 'dona', unidad: 't' })),
  PTT_SUE_PANEL_PATIOS: W('suelta', (c) => lista(c.fuentes.suelta.patios, { id: c.codigo, titulo: c.nombre || 'Patios de vehículos' })),
  PTT_SUE_TAB_RORO: W('suelta', (c) => lista(c.fuentes.suelta.roro, { id: c.codigo, titulo: c.nombre || 'Operaciones Ro-Ro' }, (r) => ({
    titulo: texto(r.motonave), detalle: [texto(r.terminal), texto(r.estado)].filter(Boolean).join(' · '), valor: num(r.avancePct), unidad: '%', progreso: num(r.avancePct), estado: r.activa ? 'ok' : 'neutro',
  }))),
  PTT_SUE_CHRT_MARCAS: W('suelta', (c) => grafica(c.fuentes.suelta.marcas, { id: c.codigo, titulo: c.nombre || 'Vehículos por marca', forma: 'barras', unidad: 'uds' })),
  PTT_SUE_PANEL_INDICADORES: W('suelta', (c) => bloqueKpis(c.codigo, c.nombre || 'Indicadores', (c.fuentes.suelta.indicadores || [])
    .map((i) => kpiSimple(`${c.codigo}.${texto(i.codigo)}`, texto(i.nombre), num(i.valor), texto(i.unidad), { estado: estadoDesdeSemaforo(i.semaforo), subtitulo: texto(i.detalle) || undefined })))),
  PTT_SUE_CHRT_HISTORICO: W('suelta', (c) => grafica(c.fuentes.suelta.historico, { id: c.codigo, titulo: c.nombre || 'Histórico mensual', forma: 'linea', unidad: 't' })),
  PTT_CAP_CHRT_SATURACION: W('capacidad', (c) => grafica(c.fuentes.capacidad.saturacion, { id: c.codigo, titulo: c.nombre || 'Saturación por categoría', forma: 'barras', unidad: '%' })),
  PTT_CAP_CHRT_TRAFICO: W('capacidad', (c) => {
    const t = c.fuentes.capacidad.trafico;
    return t ? grafica({ labels: t.labels, series: [{ nombre: 'Ingresos', valores: t.ingresos || [] }, { nombre: 'Salidas', valores: t.salidas || [] }] },
      { id: c.codigo, titulo: c.nombre || 'Tráfico por categoría', forma: 'barras', unidad: '/h' }) : null;
  }),
  PTT_CAP_TAB_NODOS: W('capacidad', (c) => lista(c.fuentes.capacidad.nodos, { id: c.codigo, titulo: c.nombre || 'Nodos' })),
  PTT_CAP_CHRT_TENDENCIA: W('capacidad', (c) => grafica(c.fuentes.capacidad.tendencia, { id: c.codigo, titulo: c.nombre || 'Tendencia de ocupación', forma: 'linea', unidad: '%' })),
  PTT_NOT_FEED: W('noticias', (c) => lista(c.fuentes.noticias.noticias, { id: c.codigo, titulo: c.nombre || 'Últimas noticias' }, (x) => ({
    titulo: texto(x.titulo), detalle: [texto(x.medio), texto(x.categoriaNombre)].filter(Boolean).join(' · '),
    valor: x.delPuerto ? 'Puerto' : '', estado: x.delPuerto ? 'ok' : 'neutro', url: /^https?:\/\//.test(texto(x.url)) ? texto(x.url) : undefined, fecha: x.fecha || undefined,
  }))),
  PTT_NOT_CORREDORES: W('noticias', (c) => lista(c.fuentes.noticias.corredores, { id: c.codigo, titulo: c.nombre || 'Corredores viales' }, (x) => ({
    titulo: texto(x.corredor), detalle: texto(x.estado), valor: num(x.eventos), unidad: 'eventos', estado: estadoDesdeSemaforo(x.semaforo),
  }))),
  PTT_NOT_CLIMA_PUERTOS: W('noticias', (c) => lista(c.fuentes.noticias.clima, { id: c.codigo, titulo: c.nombre || 'Clima en puertos' }, (x) => ({
    titulo: texto(x.puerto), detalle: [texto(x.condicion), num(x.vientoNudos) !== null ? `viento ${Math.round(x.vientoNudos)} kn` : ''].filter(Boolean).join(' · '),
    valor: num(x.temperatura) !== null ? Math.round(x.temperatura) : null, unidad: '°C', estado: 'neutro',
  }))),
  PTT_NOT_FUENTES: W('noticias', (c) => lista((c.fuentes.noticias.fuentes || []).flatMap((g) => (g.enlaces || []).map((e) => ({ ...e, grupo: g.nombre }))), { id: c.codigo, titulo: c.nombre || 'Fuentes' }, (e) => ({
    titulo: texto(e.nombre), detalle: texto(e.grupo), estado: 'neutro', url: /^https?:\/\//.test(texto(e.url)) ? texto(e.url) : undefined,
  }))),

  // ---------------- Mapa logístico (en el teléfono abre la vista de mapa)
  PTT_MAP_WGT_LOGISTICO: W(null, (c) => ({ tipo: 'mapa', id: c.codigo, titulo: c.nombre || 'Mapa logístico' })),
};

/** KPI de los tableros /api/tableros (PTT_GRA_ / PTT_SUE_ / PTT_CAP_ / PTT_NOT_): vienen con su código. */
const PREFIJO_TABLERO = Object.freeze([['PTT_GRA_KPI_', 'granel'], ['PTT_SUE_KPI_', 'suelta'], ['PTT_CAP_KPI_', 'capacidad'], ['PTT_NOT_KPI_', 'noticias']]);

/** Definición móvil de un código (o null si no tiene versión para el teléfono). */
/** Muelle de la tarjeta de terminal de la web (docks[].class) → estado de la lista. */
const estadoMuelle = (clase) => {
  const t = norm(clase);
  if (/OCUP|OCCUP|BUSY|ATRAC/.test(t)) return 'atencion';
  if (/MANT|MAINT/.test(t)) return 'neutro';
  if (/LIBRE|FREE|AVAIL|DISP/.test(t)) return 'ok';
  return 'neutro';
};

/** Una tarjeta de terminal (TERM_SLOT_n de la web): sus muelles, en el mismo orden que la tarjeta de la web. */
function tarjetaTerminal(i) {
  return W('maritimoResumen', (c) => {
    const t = (R(c).WDG_TERMINALES || [])[i];
    if (!t) return null;
    const ocup = texto(t.kpis?.ocupacion ?? t.kpis?.occupancy);
    const sub = [texto(t.badgeCount) ? `${t.badgeCount} muelles` : '', ocup ? `ocupación ${ocup}` : '',
      texto(t.kpis?.metricValue) ? `${t.kpis.metricValue} ${texto(t.kpis.metricLabel)}`.trim() : ''].filter(Boolean).join(' · ');
    const items = (t.docks || []).map((m) => ({
      titulo: texto(m.label), detalle: [texto(m.barcoAtracado), texto(m.operation), texto(m.especialidad)].filter(Boolean).join(' · '),
      valor: texto(m.class), estado: estadoMuelle(m.class),
    })).filter((x) => x.titulo);
    return { tipo: 'lista', id: `TERMINAL_${i}`, titulo: texto(t.title || t.nombre || t.name) || `Terminal ${i + 1}`, ...(sub ? { subtitulo: sub } : {}),
      total: items.length, items: items.slice(0, MAX_ITEMS) };
  });
}

function definicion(codigo) {
  const c = resolver(codigo);
  if (!c) return null;
  const term = /^TERMINAL_(\d+)$/.exec(c);
  if (term) return { codigo: c, ...tarjetaTerminal(Number(term[1])) };
  if (CATALOGO[c]) return { codigo: c, ...CATALOGO[c] };
  const t = PREFIJO_TABLERO.find(([p]) => c.startsWith(p));
  if (t) return { codigo: c, fuente: t[1], armar: (ctx) => kpiTarjeta(c, ctx.fuentes[t[1]].kpis?.[c], ctx) };
  if (c.startsWith('PTT_IA_ANALISTA_')) {
    const foco = c.slice('PTT_IA_ANALISTA_'.length);
    return { codigo: c, fuente: null, armar: (ctx) => ({ tipo: 'analista', id: c, titulo: ctx.nombre || 'Analista IA', tipos: FOCO_ANALISTA[foco] || [] }) };
  }
  return null;
}

const tieneVersionMovil = (codigo) => definicion(codigo) !== null;

/**
 * Orden de lectura del layout de la web: de arriba abajo (y) y de izquierda a derecha (x).
 * - Duplicados de un mismo código: queda el primero.
 * - TERM_SLOT_n (una tarjeta por terminal en la web) → un solo 'TERMINALES' donde estaba la primera.
 * - zonaY: en el layout por defecto de Marítimo las terminales no están en la plantilla (las arma la zona dinámica);
 *   si no hay ninguna tarjeta de terminal, «Terminales» se ubica en esa fila.
 * @param {Array<{ codigoWidget, x, y }>} filas
 * @returns {string[]} códigos en orden
 */
function ordenarLayout(filas, { zonaY = null } = {}) {
  const lista = (Array.isArray(filas) ? filas : [])
    .map((f, i) => ({ codigo: resolver(f.codigoWidget), x: num(f.x) ?? 0, y: num(f.y) ?? 0, i }))
    .filter((f) => f.codigo);
  if (num(zonaY) !== null && lista.length && !lista.some((f) => f.codigo === 'TERMINALES')) {
    lista.push({ codigo: 'TERMINALES', x: -1, y: num(zonaY), i: -1 });
  }
  lista.sort((a, b) => a.y - b.y || a.x - b.x || a.i - b.i);
  const vistos = new Set();
  return lista.filter((f) => {
    if (vistos.has(f.codigo)) return false;
    vistos.add(f.codigo);
    return true;
  }).map((f) => f.codigo);
}

/** Fuentes que hay que consultar para esos códigos (sin repetir). */
function fuentesDeLayout(codigos) {
  const s = new Set();
  for (const c of codigos || []) {
    const d = definicion(c);
    if (d?.fuente) s.add(d.fuente);
  }
  return [...s];
}

/** Agrupa KPI sueltos seguidos en un solo bloque (cuadrícula). */
function agruparKpis(widgets) {
  const salida = [];
  for (const w of widgets) {
    const suelto = w.tipo === 'kpis' && !w.titulo;
    const previo = salida[salida.length - 1];
    if (suelto && previo?.agrupable) {
      previo.items.push(...w.items);
      continue;
    }
    salida.push(suelto ? { ...w, id: `kpis.${w.id}`, titulo: 'Indicadores', agrupable: true, items: [...w.items] } : w);
  }
  return salida.map(({ agrupable, ...w }) => w);
}

/**
 * Celdas del layout de la web (x, y, cols, rows) para la rejilla tipo gridster de la app (fase A, 2026-10-25).
 * Las tarjetas de terminal (TERM_SLOT_n en el layout del usuario, o la zona dinámica en el por defecto) se rehacen para las
 * terminales que tiene el puerto, como la web: TERMINAL_0…N-1 con el tamaño de la tarjeta y de a `maxItemsPorFila` por fila.
 * Lo que está debajo de esa zona se corre lo que crezca o se encoja. La app reparte las celdas sin dejar espacios vacíos.
 * @param {Array<{ codigoWidget, x, y, cols, rows }>} filas
 * @param {{ zona?: { inicioX, inicioY, colsPorItem, rowsPorItem, maxItemsPorFila }, terminales?: number }} opciones
 * @returns {Array<{ codigo, x, y, cols, rows }>} en orden de lectura
 */
function celdasDeLayout(filas, { zona = null, terminales = 0 } = {}) {
  const base = (Array.isArray(filas) ? filas : []).map((f) => ({
    codigo: norm(f.codigoWidget), x: num(f.x) ?? 0, y: num(f.y) ?? 0, cols: Math.max(1, num(f.cols) ?? 4), rows: Math.max(1, num(f.rows) ?? 3),
  })).filter((f) => f.codigo);
  const vistos = new Set();
  const unicos = base.filter((f) => (vistos.has(f.codigo) ? false : (vistos.add(f.codigo), true)));
  const slots = unicos.filter((f) => /^TERM_SLOT_\d+$/.test(f.codigo));
  let resto = unicos.filter((f) => !/^TERM_SLOT_\d+$/.test(f.codigo));
  let z = null;
  if (slots.length) {
    const ini = Math.min(...slots.map((f) => f.y));
    z = { x: Math.min(...slots.map((f) => f.x)), y: ini, cw: slots[0].cols, rh: slots[0].rows,
      porFila: Math.max(1, Math.floor(12 / slots[0].cols)), alto: Math.max(...slots.map((f) => f.y + f.rows)) - ini };
  } else if (zona && num(zona.inicioY) !== null) {
    z = { x: num(zona.inicioX) ?? 0, y: num(zona.inicioY), cw: num(zona.colsPorItem) || 4, rh: num(zona.rowsPorItem) || 3,
      porFila: num(zona.maxItemsPorFila) || 3, alto: 0 };
  }
  const tarjetas = [];
  if (z) {
    const n = Math.max(0, Math.floor(num(terminales) || 0));
    const nuevoAlto = Math.ceil(n / z.porFila) * z.rh;
    const corrimiento = nuevoAlto - z.alto;
    resto = resto.map((f) => (f.y >= z.y + z.alto && corrimiento ? { ...f, y: f.y + corrimiento } : f));
    for (let i = 0; i < n; i++) {
      tarjetas.push({ codigo: `TERMINAL_${i}`, x: z.x + (i % z.porFila) * z.cw, y: z.y + Math.floor(i / z.porFila) * z.rh, cols: z.cw, rows: z.rh });
    }
  }
  return [...resto, ...tarjetas].sort((a, b) => a.y - b.y || a.x - b.x);
}

/**
 * Widgets móviles de un layout.
 * @param {{ codigos: string[], fuentes: Object, filas?: Array, series?: Map, nombres?: Object<codigo, nombreWidget> }} p
 */
function armarWidgets({ codigos = [], celdas = null, fuentes = {}, filas = [], series = new Map(), nombres = {} }) {
  const widgets = [];
  const soloWeb = [];
  const sinDatos = [];
  const nombreDe = (c) => texto(nombres[c]);
  // Con celdas (rejilla tipo gridster): cada widget lleva la suya y los KPI no se agrupan (cada uno ocupa su celda, como en la web)
  const celdaDe = new Map((celdas || []).map((c) => [c.codigo, { x: c.x, y: c.y, cols: c.cols, rows: c.rows }]));
  const lista = celdas ? celdas.map((c) => c.codigo) : codigos;
  for (const original of lista) {
    const d = definicion(original);
    if (!d) {
      const c = norm(original);
      soloWeb.push({ codigo: c, nombre: nombreDe(c) || c });
      continue;
    }
    const nombre = nombreDe(norm(original)) || nombreDe(d.codigo);
    let w = null;
    if (!d.fuente || fuentes[d.fuente]) {
      try {
        w = d.armar({ codigo: d.codigo, nombre, fuentes, filas, series });
      } catch {
        w = null;
      }
    }
    // Sin dato o sin fuente: tarjeta vacía con su título, como la web (que pinta el widget con «Sin datos»), para que la
    // rejilla quede igual a la de la web; no se inventa un valor (decisión del usuario, 2026-10-25).
    if (!w) {
      sinDatos.push(d.codigo);
      w = { tipo: 'vacio', id: d.codigo, titulo: nombre || TITULO_RESPALDO[d.codigo] || humanizar(d.codigo) };
    }
    const celda = celdaDe.get(norm(original));
    widgets.push({ ...w, codigo: d.codigo, ...(celda ? { celda } : {}) });
  }
  return { widgets: celdas ? widgets : agruparKpis(widgets), soloWeb, sinDatos };
}

module.exports = {
  ALIAS, SERIE_DE, FOCO_ANALISTA, GNL_VIVO, GNL_COMPONENTES, CATALOGO, PREFIJO_TABLERO, MAX_ITEMS,
  resolver, definicion, tieneVersionMovil, ordenarLayout, celdasDeLayout, fuentesDeLayout, agruparKpis, armarWidgets, itemGenerico, humanizar, TITULO_RESPALDO,
};
