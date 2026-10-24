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
  const hoyPorOperacion = new Map();
  for (const a of avance) {
    if (Date.parse(a.hora) < hoyMs) continue;
    const op = porId.get(String(a.id_operacion));
    if (!op || !(op.tipo in hoy)) continue;
    hoy[op.tipo] += C.num(a.cantidad) || 0;
    hoyPorOperacion.set(String(a.id_operacion), (hoyPorOperacion.get(String(a.id_operacion)) || 0) + (C.num(a.cantidad) || 0));
    if (op.producto) productosHoy[op.tipo].add(op.producto);
  }
  // Vista ampliada de los KPI: toneladas de hoy por motonave y serie de 24 h del tipo
  const desgloseTipo = (tipo) => [...hoyPorOperacion.entries()]
    .map(([id, t]) => ({ op: porId.get(id), t }))
    .filter((x) => x.op?.tipo === tipo)
    .sort((a, b) => b.t - a.t)
    .map((x) => ({ etiqueta: [x.op.motonave, x.op.producto].filter(Boolean).join(' · ') || `Operación ${x.op.id_operacion}`, valor: Math.round(x.t), unidad: 't' }));
  const serieTipo = (tipo) => {
    const s = C.serieHoraria(avance.filter((a) => porId.get(String(a.id_operacion))?.tipo === tipo), ahoraMs, 24, 'hora', 'cantidad');
    return { '24 h': { labels: s.labels, valores: s.valores } };
  };
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
      desglose: desgloseTipo(tipo), serie: serieTipo(tipo),
      definicion: 'Toneladas operadas desde la medianoche (hora de Colombia), según el avance horario de cada motonave.',
    });
  }
  kpis.PTT_GRA_KPI_EQUIPOS = C.kpi({
    titulo: 'EQUIPOS EN USO', valor: `${enUso.length}/${equiposGranel.length}`, unidad: '', colorBorde: 'borde-blue',
    icono: 'feather icon-settings', simulado,
    subtitulo: equiposGranel.length ? 'Aspiradores · grúas · cintas' : 'Sin equipos registrados',
    desglose: C.agrupar(equiposGranel, (e) => `${e.tipo} · ${e.estado}`, () => 1).map((g) => ({ etiqueta: g.clave, valor: g.valor, unidad: 'equipos' })),
    definicion: 'Aspiradores, grúas móviles y cintas en estado OPERANDO sobre el total de esos equipos (volquetas y demás no cuentan).',
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

/**
 * Serie de avance (vista ampliada, Fase 3): de una operación (t/h por hora, acumulado y ritmo necesario para
 * terminar en la fecha estimada) o, sin operación, por tipo de granel. 24 y 72 h por hora; 168 h por día.
 * @param {{ avance:object[], operaciones:object[], operacion?:object|null, horas:number }} datos
 */
function serieAvance({ avance = [], operaciones = [], operacion = null, horas = 24 }, ahora = new Date()) {
  const ahoraMs = ahora.getTime();
  const porDia = horas > 72;
  const agrupar = (filas) => {
    if (!porDia) return C.serieHoraria(filas, ahoraMs, horas, 'hora', 'cantidad');
    const dias = Array.from({ length: Math.ceil(horas / 24) }, (_, i) => C.inicioDiaColombia(ahoraMs) - (Math.ceil(horas / 24) - 1 - i) * 86400000);
    const valores = dias.map((d) => C.redondear(C.suma(filas.filter((f) => C.inicioDiaColombia(Date.parse(f.hora)) === d), (f) => f.cantidad), 1));
    const labels = dias.map((d) => new Date(d).toISOString().slice(5, 10).split('-').reverse().join('/'));
    return { labels, valores };
  };
  if (operacion) {
    const s = agrupar(avance);
    let acumulado = 0;
    const total = C.num(operacion.cantidad_total) || 0;
    const operadas = Math.min(total, C.num(operacion.cantidad_operada) || 0);
    const finMs = Date.parse(operacion.fecha_fin_estimada);
    const horasRestantes = Number.isFinite(finMs) ? (finMs - ahoraMs) / 3600000 : null;
    const ritmoNecesario = horasRestantes !== null && horasRestantes > 0 ? C.redondear((total - operadas) / horasRestantes, 1) : null;
    return {
      operacion: {
        idOperacion: operacion.id_operacion, motonave: operacion.motonave, producto: operacion.producto, tipo: operacion.tipo,
        total, operadas, pendiente: C.redondear(total - operadas, 1), finEstimado: operacion.fecha_fin_estimada || null, simulado: !!operacion.simulado,
      },
      labels: s.labels, valores: s.valores, acumulado: s.valores.map((v) => (acumulado = C.redondear(acumulado + v, 1))),
      ritmoNecesarioTmh: ritmoNecesario, unidad: porDia ? 't/día' : 't/h', horas,
    };
  }
  const tipoDe = new Map(operaciones.map((o) => [String(o.id_operacion), o.tipo]));
  const series = {};
  let labels = [];
  for (const tipo of ['AGRICOLA', 'MINERAL', 'LIQUIDO']) {
    const s = agrupar(avance.filter((a) => tipoDe.get(String(a.id_operacion)) === tipo));
    labels = s.labels;
    series[tipo] = s.valores;
  }
  return { labels, series, unidad: porDia ? 't/día' : 't/h', horas };
}

module.exports = { serieAvance, TIPOS, armarGranel };
