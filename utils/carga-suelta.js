/*
    Author: German Valencia
    Pattern: PORTTOS Núcleo puro (AD-16) - Tablero de Carga suelta y vehículos (TLC_SUELTA_001)
    Description: Sin base de datos ni red.
      Entradas:
        folios     TCL_CargaSuelta activos (no despachados) o despachados en las últimas 24 h
        roro       TCL_OperacionesBuque (segmento RORO) activas o terminadas en las últimas 24 h
        avanceRoro TCL_AvanceOperacionBuque (segmento RORO) de las últimas 24 h
        vehiculos  TCL_InventarioVehiculos del puerto (última foto por patio, marca y flujo)
        patios     TCL_CapacidadNodos de categoría PATIO_PDI
        historico  TCL_HistoricosSupertransporte del puerto
      Salida: { kpis, breakBulk, proyecto, composicion, patios, roro, marcas, indicadores, historico, simulado }
*/
const C = require('./tablero-comun');

const ACTIVO = (f) => f.estado !== 'DESPACHADO';
const RORO_ACTIVA = new Set(['OPERANDO', 'FONDEADA', 'PROGRAMADA', 'SUSPENDIDA']);
const RITMO_OBJETIVO_UDS_MIN = 2.5;

function armarCargaSuelta({ folios = [], roro = [], avanceRoro = [], vehiculos = [], patios = [], historico = [], puerto = null }, ahora = new Date()) {
  const ahoraMs = ahora.getTime();
  const simulado = [folios, roro, vehiculos].some((l) => l.some((x) => x.simulado));
  const activos = folios.filter(ACTIVO);
  const bb = activos.filter((f) => f.clase === 'BREAK_BULK');
  const pr = activos.filter((f) => f.clase === 'PROJECT_CARGO');
  const esperanPermiso = pr.filter((f) => f.requiere_permiso && !f.permiso_aprobado);
  const importados = vehiculos.filter((v) => v.flujo === 'IMPORTACION');
  const exportados = vehiculos.filter((v) => v.flujo === 'EXPORTACION');
  const roroOperando = roro.find((r) => r.estado === 'OPERANDO');
  const productosBb = C.agrupar(bb, (f) => f.producto, (f) => f.tm);

  const kpis = {
    PTT_SUE_KPI_BREAKBULK: C.kpi({
      titulo: 'BREAK-BULK', valor: Math.round(C.suma(bb, (f) => f.tm)), unidad: 't', colorBorde: 'borde-amarillo',
      icono: 'feather icon-box', simulado,
      subtitulo: productosBb.length ? productosBb.slice(0, 4).map((p) => p.clave.toLowerCase()).join(' · ') : 'Sin carga suelta activa',
      desglose: productosBb.map((p) => ({ etiqueta: p.clave, valor: p.valor, unidad: 't' })),
      definicion: 'Toneladas de los folios de break-bulk que no han sido despachados.',
    }),
    PTT_SUE_KPI_PROYECTO: C.kpi({
      // Corregido 2026-10-24: la unidad decía 'bultos' pero el valor cuenta folios
      titulo: 'PROJECT CARGO', valor: pr.length, unidad: 'folios', colorBorde: 'borde-purple', icono: 'feather icon-truck', simulado,
      subtitulo: esperanPermiso.length ? `${esperanPermiso.length} esperan permiso vial` : 'Maquinaria y bultos pesados',
      desglose: C.agrupar(pr, (f) => (!f.requiere_permiso ? 'No requiere permiso' : f.permiso_aprobado ? 'Permiso aprobado' : 'Esperan permiso vial'), () => 1)
        .map((g) => ({ etiqueta: g.clave, valor: g.valor, unidad: 'folios', semaforo: g.clave === 'Esperan permiso vial' ? 'amarillo' : 'verde' })),
      definicion: 'Folios de project cargo activos (no despachados).',
    }),
    PTT_SUE_KPI_VEH_IMPORT: C.kpi({
      titulo: 'VEHÍCULOS IMPORTADOS', valor: C.suma(importados, (v) => v.unidades), unidad: 'uds', colorBorde: 'borde-cyan',
      icono: 'feather icon-log-in', simulado,
      subtitulo: roroOperando ? `m/v ${roroOperando.motonave} descargando` : 'En patios de vehículos',
      desglose: C.agrupar(importados, (v) => v.marca, (v) => v.unidades).map((g) => ({ etiqueta: g.clave, valor: g.valor, unidad: 'uds' })),
      definicion: 'Unidades de importación en patios según la última foto del inventario de vehículos.',
    }),
    PTT_SUE_KPI_VEH_EXPORT: C.kpi({
      titulo: 'VEHÍCULOS EXPORTACIÓN', valor: C.suma(exportados, (v) => v.unidades), unidad: 'uds', colorBorde: 'borde-green',
      icono: 'feather icon-log-out', simulado, subtitulo: 'Parqueo pre-embarque',
      desglose: C.agrupar(exportados, (v) => v.marca, (v) => v.unidades).map((g) => ({ etiqueta: g.clave, valor: g.valor, unidad: 'uds' })),
      definicion: 'Unidades de exportación en patios según la última foto del inventario de vehículos.',
    }),
  };

  const fila = (f) => ({
    folio: f.folio, producto: f.producto, cliente: f.cliente, motonave: f.motonave, naviera: f.naviera, terminal: f.terminal,
    sentido: f.sentido, bultos: C.num(f.bultos), bultosRecibidos: C.num(f.bultos_recibidos), tm: C.num(f.tm),
    pesoUnitarioTm: C.num(f.peso_unitario_tm), dimensiones: f.dimensiones, equipoRequerido: f.equipo_requerido,
    ubicacion: f.ubicacion, requierePermiso: !!f.requiere_permiso, permisoAprobado: f.permiso_aprobado === null ? null : !!f.permiso_aprobado,
    estado: f.estado, fechaProgramada: f.fecha_programada, simulado: !!f.simulado,
  });

  // Patios de vehículos: unidades actuales frente a la capacidad del nodo
  const porPatio = new Map();
  for (const v of vehiculos) {
    const p = porPatio.get(v.id_nodo) || { unidades: 0, marcas: new Map() };
    p.unidades += C.num(v.unidades) || 0;
    p.marcas.set(v.marca, (p.marcas.get(v.marca) || 0) + (C.num(v.unidades) || 0));
    porPatio.set(v.id_nodo, p);
  }
  const patiosArmados = patios.map((n) => {
    const p = porPatio.get(n.id_nodo) || { unidades: 0, marcas: new Map() };
    const capacidad = C.num(n.capacidad) || 0;
    const porcentaje = C.pct(p.unidades, capacidad);
    const marcas = [...p.marcas.entries()].sort((a, b) => b[1] - a[1]).map(([m]) => m);
    return { id: n.id_nodo, nombre: n.nombre, capacidad, unidades: p.unidades, porcentaje, semaforo: C.semaforo(porcentaje), marcas };
  }).sort((a, b) => b.porcentaje - a.porcentaje);

  const marcas = C.agrupar(vehiculos, (v) => v.marca, (v) => v.unidades);
  const composicion = C.agrupar(activos, (f) => f.producto, (f) => f.tm);

  // Indicadores de operación especial
  const desde3h = C.inicioHora(ahoraMs) - 2 * 3600000;
  const udsUltimas3h = C.suma(avanceRoro.filter((a) => Date.parse(a.hora) >= desde3h), (a) => a.cantidad);
  const ritmoRoro = udsUltimas3h > 0 ? C.redondear(udsUltimas3h / 180, 1) : null;
  const totalVeh = C.suma(vehiculos, (v) => v.unidades);
  const estadia = totalVeh > 0 ? C.redondear(C.suma(vehiculos, (v) => (C.num(v.dias_promedio) || 0) * (C.num(v.unidades) || 0)) / totalVeh, 1) : null;
  const bultos = C.suma(bb, (f) => f.bultos);
  const recibidos = C.suma(bb, (f) => f.bultos_recibidos);
  const conPermiso = pr.filter((f) => f.requiere_permiso && f.permiso_aprobado).length;
  const indicadores = [
    { codigo: 'RITMO_RORO', nombre: 'Ritmo de descarga Ro-Ro', valor: ritmoRoro, unidad: 'uds/min',
      detalle: `objetivo ${RITMO_OBJETIVO_UDS_MIN}`, semaforo: ritmoRoro === null ? 'gris' : ritmoRoro >= RITMO_OBJETIVO_UDS_MIN ? 'verde' : ritmoRoro >= RITMO_OBJETIVO_UDS_MIN * 0.8 ? 'amarillo' : 'rojo' },
    { codigo: 'ESTADIA_PDI', nombre: 'Estadía media en patio', valor: estadia, unidad: 'días',
      detalle: 'promedio ponderado por unidades', semaforo: estadia === null ? 'gris' : estadia <= 7 ? 'verde' : estadia <= 10 ? 'amarillo' : 'rojo' },
    { codigo: 'BULTOS', nombre: 'Bultos break-bulk', valor: bultos, unidad: 'bultos',
      detalle: bultos > 0 ? `${C.pct(recibidos, bultos)} % recibido` : 'sin bultos activos', semaforo: 'gris' },
    { codigo: 'PROYECTO', nombre: 'Project cargo activo', valor: pr.length, unidad: 'op.',
      detalle: `${conPermiso} con permiso vial`, semaforo: esperanPermiso.length ? 'amarillo' : 'verde' },
  ];

  return {
    puerto,
    generadoEn: ahora.toISOString(),
    simulado,
    kpis,
    breakBulk: folios.filter((f) => f.clase === 'BREAK_BULK').map(fila),
    proyecto: folios.filter((f) => f.clase === 'PROJECT_CARGO').map(fila),
    composicion: { labels: composicion.map((p) => p.clave), valores: composicion.map((p) => p.valor) },
    patios: patiosArmados,
    roro: roro.map((r) => {
      const total = C.num(r.cantidad_total) || 0;
      const operadas = Math.min(total, C.num(r.cantidad_operada) || 0);
      return {
        motonave: r.motonave, naviera: r.naviera, terminal: r.terminal || r.id_terminal, muelle: r.codigo_muelle,
        producto: r.producto, total, operadas, avancePct: C.pct(operadas, total), eta: r.eta, estado: r.estado,
        activa: RORO_ACTIVA.has(r.estado), simulado: !!r.simulado,
      };
    }).sort((a, b) => (a.estado === 'OPERANDO' ? 0 : 1) - (b.estado === 'OPERANDO' ? 0 : 1) || String(a.eta || '').localeCompare(String(b.eta || ''))),
    marcas: { labels: marcas.map((m) => m.clave), valores: marcas.map((m) => m.valor) },
    indicadores,
    historico: C.historicoMensual(historico, { 'Carga general': (t) => t.includes('GENERAL') }),
  };
}

module.exports = { armarCargaSuelta, RITMO_OBJETIVO_UDS_MIN };
