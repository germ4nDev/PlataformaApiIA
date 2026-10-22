/*
    Author: German Valencia
    Pattern: PORTTOS Núcleo puro (AD-16) - Tablero de Granel (TLC_GRANEL_001)
    Description: Arma el tablero a partir de lo que entrega el repositorio; sin base de datos ni red.
      Entradas:
        operaciones  TCL_OperacionesBuque (segmento GRANEL) activas o terminadas en las últimas 24 h
        avance       TCL_AvanceOperacionBuque (segmento GRANEL) de las últimas 24 h: { id_operacion, hora, cantidad }
        equipos      TCL_EquiposPortuarios de granel o multipropósito
        bodegas      TCL_MaestroBodegas cuyo tipo de carga es granel
        historico    TCL_HistoricosSupertransporte del puerto: { anio, mes, tipo_carga, toneladas }
      Salida: { kpis, motonaves, productos, equipos, bodegas, tendencia, historico, simulado }
*/
const C = require('./tablero-comun');

const TIPOS = Object.freeze({
  AGRICOLA: { codigo: 'PTT_GRA_KPI_AGRICOLA', titulo: 'GRANEL AGRÍCOLA', colorBorde: 'borde-green', icono: 'feather icon-sun' },
  MINERAL: { codigo: 'PTT_GRA_KPI_MINERAL', titulo: 'GRANEL MINERAL', colorBorde: 'borde-naranja', icono: 'feather icon-layers' },
  LIQUIDO: { codigo: 'PTT_GRA_KPI_LIQUIDO', titulo: 'GRANEL LÍQUIDO', colorBorde: 'borde-teal', icono: 'feather icon-droplet' },
});
const ACTIVAS = new Set(['OPERANDO', 'SUSPENDIDA', 'FONDEADA', 'PROGRAMADA']);
const EQUIPOS_DE_GRANEL = new Set(['ASPIRADOR', 'GRUA_MOVIL', 'CINTA']);

const minusculas = (lista) => lista.map((p) => String(p).toLowerCase());

function armarGranel({ operaciones = [], avance = [], equipos = [], bodegas = [], historico = [], puerto = null }, ahora = new Date()) {
  const ahoraMs = ahora.getTime();
  const hoyMs = C.inicioDiaColombia(ahoraMs);
  const porId = new Map(operaciones.map((o) => [String(o.id_operacion), o]));
  const simulado = operaciones.some((o) => o.simulado) || equipos.some((e) => e.simulado);

  // Toneladas operadas hoy por tipo (avance desde la medianoche de Colombia)
  const hoy = { AGRICOLA: 0, MINERAL: 0, LIQUIDO: 0 };
  const productosHoy = { AGRICOLA: new Set(), MINERAL: new Set(), LIQUIDO: new Set() };
  for (const a of avance) {
    if (Date.parse(a.hora) < hoyMs) continue;
    const op = porId.get(String(a.id_operacion));
    if (!op || !(op.tipo in hoy)) continue;
    hoy[op.tipo] += C.num(a.cantidad) || 0;
    if (op.producto) productosHoy[op.tipo].add(op.producto);
  }
  // Ritmo de cada operación: promedio de las últimas 3 horas con avance
  const desde3h = C.inicioHora(ahoraMs) - 2 * 3600000;
  const ritmo = new Map();
  for (const a of avance) {
    if (Date.parse(a.hora) < desde3h) continue;
    ritmo.set(String(a.id_operacion), (ritmo.get(String(a.id_operacion)) || 0) + (C.num(a.cantidad) || 0) / 3);
  }

  const equiposGranel = equipos.filter((e) => EQUIPOS_DE_GRANEL.has(e.tipo));
  const enUso = equiposGranel.filter((e) => e.estado === 'OPERANDO');
  const kpis = {};
  for (const [tipo, d] of Object.entries(TIPOS)) {
    const prods = minusculas([...productosHoy[tipo]]).slice(0, 4).join(' · ');
    kpis[d.codigo] = C.kpi({
      titulo: d.titulo, valor: Math.round(hoy[tipo]), unidad: 't', colorBorde: d.colorBorde, icono: d.icono, simulado,
      subtitulo: prods ? `Hoy · ${prods}` : 'Sin operación hoy',
    });
  }
  kpis.PTT_GRA_KPI_EQUIPOS = C.kpi({
    titulo: 'EQUIPOS EN USO', valor: `${enUso.length}/${equiposGranel.length}`, unidad: '', colorBorde: 'borde-blue',
    icono: 'feather icon-settings', simulado,
    subtitulo: equiposGranel.length ? 'Aspiradores · grúas · cintas' : 'Sin equipos registrados',
  });

  const visibles = operaciones
    .filter((o) => ACTIVAS.has(o.estado) || (o.fecha_fin && ahoraMs - Date.parse(o.fecha_fin) < 24 * 3600000))
    .map((o) => {
      const total = C.num(o.cantidad_total) || 0;
      const operadas = Math.min(total, C.num(o.cantidad_operada) || 0);
      const r = ritmo.get(String(o.id_operacion)) || 0;
      const restante = total - operadas;
      return {
        idOperacion: o.id_operacion, motonave: o.motonave, terminal: o.terminal || o.id_terminal, muelle: o.codigo_muelle,
        tipo: o.tipo, producto: o.producto, sentido: o.sentido,
        tmTotal: Math.round(total), tmOperadas: Math.round(operadas), avancePct: C.pct(operadas, total),
        ritmoTmh: Math.round(r),
        finEstimado: o.estado === 'OPERANDO' && r > 0 ? new Date(ahoraMs + (restante / r) * 3600000).toISOString() : o.fecha_fin_estimada || null,
        equipos: equipos.filter((e) => String(e.id_operacion) === String(o.id_operacion)).map((e) => e.codigo_equipo),
        estado: o.estado, simulado: !!o.simulado,
      };
    })
    .sort((a, b) => (a.estado === 'OPERANDO' ? 0 : 1) - (b.estado === 'OPERANDO' ? 0 : 1) || b.tmTotal - a.tmTotal);

  const enCurso = visibles.filter((m) => m.estado !== 'TERMINADA');
  const productos = C.agrupar(enCurso, (m) => m.producto, (m) => m.tmTotal);

  const tendencia = C.serieHoraria(avance, ahoraMs, 24);
  const maximo = Math.max(0, ...tendencia.valores);
  const iPico = tendencia.valores.indexOf(maximo);

  return {
    puerto,
    generadoEn: ahora.toISOString(),
    simulado,
    kpis,
    motonaves: visibles,
    productos: { labels: productos.map((p) => p.clave), valores: productos.map((p) => p.valor) },
    equipos: equipos.map((e) => ({
      codigo: e.codigo_equipo, tipo: e.tipo, descripcion: e.descripcion, terminal: e.terminal,
      motonave: e.motonave || porId.get(String(e.id_operacion))?.motonave || null,
      producto: e.producto || porId.get(String(e.id_operacion))?.producto || null,
      rendimientoTmh: C.num(e.rendimiento_tmh), capacidadTmh: C.num(e.capacidad_tmh), estado: e.estado,
    })).sort((a, b) => a.codigo.localeCompare(b.codigo)),
    bodegas: bodegas.map((b) => {
      const capacidad = C.num(b.capacidad_maxima_ton) || 0;
      const inventario = C.num(b.inventario_actual_ton) || 0;
      const p = C.pct(inventario, capacidad);
      return { id: b.id_bodega, nombre: b.nombre_bodega, producto: b.tipo_carga_principal, capacidad, inventario, porcentaje: p, semaforo: C.semaforo(p) };
    }).sort((a, b) => b.porcentaje - a.porcentaje),
    tendencia: {
      labels: tendencia.labels, valores: tendencia.valores,
      total24h: Math.round(C.suma(tendencia.valores)),
      pico: maximo > 0 ? { hora: tendencia.labels[iPico], tmh: Math.round(maximo) } : null,
    },
    historico: C.historicoMensual(historico, {
      // Supertransporte: 'GRANEL SOLIDO DIFER. DE CARBON', 'GRANEL LIQUIDO', 'CARBON AL GRANEL'
      'Granel sólido': (t) => t.includes('SOLIDO'),
      'Granel líquido': (t) => t.includes('LIQUIDO'),
      'Carbón': (t) => t.startsWith('CARBON'),
    }),
  };
}

module.exports = { TIPOS, armarGranel };
