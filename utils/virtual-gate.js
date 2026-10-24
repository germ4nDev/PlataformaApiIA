/*
    Author: German Valencia
    Pattern: PORTTOS Núcleo puro (AD-16) - Virtual Gate (TLC_VIRTUAL_GATE_001)
    Description: Sin base de datos ni red. Arma el tablero del Virtual Gate a partir de las filas de citas.
      Reglas de honestidad del dato (Fase 1 de la vista ampliada, 2026-10-23):
      - Ventana real: solo cuentan las citas de las últimas 24 h y las próximas 24 h (hora de la cita). Las citas
        sin fecha solo cuentan si siguen activas. Antes se leía todo el histórico, incluidas las finalizadas.
      - Nada se inventa en silencio: los campos que faltan quedan en null y la cita lista sus `imputados`; la
        distancia estimada por la ubicación se marca `distancia_estimada`. Las validaciones sin dato son null (antes
        valían true y casi todo salía "validado").
      - Toneladas solo con peso de báscula (antes 34 y 22 t por camión cuando faltaba).
      - "Próximas 12 h" son de verdad las próximas 12 h, en franjas de 2 h (hora de Colombia).
      - Un solo umbral de espera para alertas, semáforo y retrasos: atención ≥ 25 min, crítico ≥ 45 min.
*/
const C = require('./tablero-comun');
const { origen } = require('./origen-dato');

const UMBRALES_ESPERA = Object.freeze({ atencion: 25, critico: 45 });
const VENTANA = Object.freeze({ atrasHoras: 24, adelanteHoras: 24 });
const ESTADOS_FINALES = ['FINALIZADO', 'CANCELADO', 'ATENDIDO', 'SALIO', 'SALIDA'];
const ESTADOS_ATENDIDA = ['ATENDIDO', 'EN_OPERACION', 'EN_PUERTO', 'VALIDADO', 'FINALIZADO', 'LLAMADO'];
const ESTADOS_COLA = ['EN_COLA', 'ENTURNADO', 'PRE_GATE', 'PROGRAMADO', 'EN_RUTA'];
const ESTADOS_RETENIDA = ['RETENIDO', 'RECHAZADO', 'OBSERVADO', 'BLOQUEADO', 'SIN_CITA'];
const MAX_ALERTAS = 20;

const texto = (v) => (v === null || v === undefined || String(v).trim() === '' ? null : String(v).trim());
const mayus = (v) => (texto(v) === null ? null : texto(v).toUpperCase().replace(/\s+/g, '_'));
const bool = (v) => (v === null || v === undefined || v === '' ? null : v === true || v === 1 || v === '1' || String(v).toUpperCase() === 'TRUE' || String(v).toUpperCase() === 'SI');

/** Distancia aproximada por el texto de la ubicación (solo si la fila no trae distancia_km). */
function estimarDistancia(ubicacion) {
  const u = String(ubicacion || '').toUpperCase();
  if (!u) return null;
  if (u.includes('PRE')) return 0.5;
  if (u.includes('ENTURN')) return 2.2;
  return 4.5;
}

/** Franja de 2 h en hora de Colombia, p. ej. '08:00 - 10:00'. */
function franjaHoraria(fechaIso) {
  const ms = Date.parse(fechaIso);
  if (!Number.isFinite(ms)) return null;
  const h = C.horaColombia(ms);
  const ini = h - (h % 2);
  return `${String(ini).padStart(2, '0')}:00 - ${String((ini + 2) % 24).padStart(2, '0')}:00`;
}

/** Fila cruda de TCL_CitasVirtualGate / TCL_CitasGate → cita normalizada con la lista de campos imputados. */
function normalizarCita(row, index, puerto) {
  const imputados = [];
  const tomar = (campo, ...valores) => {
    const v = valores.find((x) => texto(x) !== null);
    if (v === undefined) imputados.push(campo);
    return v === undefined ? null : v;
  };
  const espera = C.num(row.tiempo_espera_minutos ?? row.tiempo_espera ?? row.minutos_espera);
  const ubicacion = texto(tomar('ubicacion', row.ubicacion, row.zona_actual));
  const fecha = tomar('fecha_hora_cita', row.fecha_hora_cita, row.fecha_cita);
  const fechaIso = fecha && Number.isFinite(Date.parse(fecha)) ? new Date(fecha).toISOString() : null;
  let distancia = C.num(row.distancia_km);
  const distanciaEstimada = distancia === null;
  if (distanciaEstimada) distancia = estimarDistancia(ubicacion);
  const v = { ocr: bool(row.validacion_ocr), biometria: bool(row.validacion_biometria), documental: bool(row.validacion_documental) };
  const peso = C.num(row.peso_bascula_ton ?? row.toneladas);

  return {
    id_cita: texto(row.id_cita ?? row.codigo_cita) || `VG-${String(puerto).slice(0, 3)}-${1000 + index}`,
    placa: texto(tomar('placa', row.placa, row.placa_vehiculo))?.toUpperCase() ?? null,
    conductor: texto(tomar('conductor', row.conductor, row.nombre_conductor)),
    transportador: texto(tomar('transportador', row.transportador, row.empresa_transporte, row.empresa)),
    tipo_carga: mayus(tomar('tipo_carga', row.tipo_carga, row.modalidad)),
    operacion: mayus(tomar('operacion', row.operacion, row.tipo_operacion)),
    terminal: mayus(tomar('terminal', row.terminal, row.nodo_terminal)),
    estado: mayus(tomar('estado', row.estado, row.estado_cita)) || 'SIN_ESTADO',
    ubicacion,
    fecha_hora_cita: fechaIso,
    franja_horaria: texto(row.franja_horaria) || franjaHoraria(fechaIso),
    distancia_km: distancia,
    distancia_estimada: distanciaEstimada && distancia !== null,
    tiempo_espera_minutos: espera ?? 0,
    tiempo_espera: espera === null ? null : `${espera} min`,
    validacion_ocr: v.ocr,
    validacion_biometria: v.biometria,
    validacion_documental: v.documental,
    peso_bascula_ton: peso,
    simulado: row.simulado === true || row.simulado === 1,
    imputados,
  };
}

const esFinal = (c) => ESTADOS_FINALES.includes(c.estado);
const esRetenida = (c) => ESTADOS_RETENIDA.includes(c.estado);
const esRetrasada = (c) => c.estado.includes('RETRAS') || (!esFinal(c) && !esRetenida(c) && c.tiempo_espera_minutos >= UMBRALES_ESPERA.critico);
const esCola = (c) => ESTADOS_COLA.includes(c.estado) && !esRetrasada(c);
const esAtendida = (c) => ESTADOS_ATENDIDA.includes(c.estado);

/** Citas de la ventana [ahora − 24 h, ahora + 24 h]; sin fecha solo si siguen activas. */
function enVentana(citas, ahoraMs) {
  const desde = ahoraMs - VENTANA.atrasHoras * 3600000;
  const hasta = ahoraMs + VENTANA.adelanteHoras * 3600000;
  return citas.filter((c) => {
    const ms = Date.parse(c.fecha_hora_cita);
    return Number.isFinite(ms) ? ms >= desde && ms <= hasta : !esFinal(c);
  });
}

const tipo = {
  contenedor: (c) => (c.tipo_carga || '').includes('CONT'),
  granel: (c) => (c.tipo_carga || '').includes('GRANEL'),
  suelta: (c) => /SUELTA|GENERAL/.test(c.tipo_carga || ''),
  roro: (c) => /RORO|VEH|NI[ÑN]ERA/.test(c.tipo_carga || ''),
};

function resumenKpis(citas, infoBodegas) {
  const activas = citas.filter((c) => !esFinal(c));
  const sumarPeso = (lista) => C.redondear(C.suma(lista, (c) => c.peso_bascula_ton), 1);
  const sinPeso = (lista) => lista.filter((c) => c.peso_bascula_ton === null).length;
  const por = Object.fromEntries(Object.entries(tipo).map(([k, f]) => [k, citas.filter(f)]));
  const sat = C.num(infoBodegas?.saturacionPromedio);
  const notaPeso = (lista) => (sinPeso(lista) ? ` · ${sinPeso(lista)} sin pesaje` : '');
  return {
    totalCamiones: activas.length,
    validados: activas.filter(esAtendida).length,
    enCola: activas.filter(esCola).length,
    totalContenedores: por.contenedor.length,
    subtituloContenedores: `${por.contenedor.filter((c) => !esFinal(c)).length} activas · ventana 48 h`,
    totalGranel: sumarPeso(por.granel),
    subtituloGranel: `${por.granel.length} camiones${notaPeso(por.granel)}`,
    totalCargaSuelta: sumarPeso(por.suelta),
    subtituloCargaSuelta: `${por.suelta.length} turnos${notaPeso(por.suelta)}`,
    totalRoro: por.roro.length,
    subtituloRoro: `${por.roro.filter((c) => !esFinal(c)).length} activas · ventana 48 h`,
    saturacionBodegas: sat === null ? null : `${C.redondear(sat, 1)}%`,
    subtituloBodegas: sat === null ? 'Sin dato de bodegas' : `${infoBodegas?.totalBodegas || 0} bodegas monitoreadas`,
    subContenedores: por.contenedor.filter((c) => !esFinal(c)).length,
    subGranel: por.granel.filter((c) => !esFinal(c)).length,
    subCargaSuelta: por.suelta.filter((c) => !esFinal(c)).length,
    subNineras: por.roro.filter((c) => !esFinal(c)).length,
    pesoSinBascula: sinPeso(citas),
  };
}

/** Próximas 12 h en franjas de 2 h (hora de Colombia), apiladas por terminal. */
function citasProximas12h(citas, ahoraMs) {
  const inicio = ahoraMs - (ahoraMs % 3600000);
  const bloques = Array.from({ length: 6 }, (_, i) => inicio + i * 2 * 3600000);
  const labels = bloques.map((ms) => {
    const h = C.horaColombia(ms);
    return `${String(h).padStart(2, '0')}:00 - ${String((h + 2) % 24).padStart(2, '0')}:00`;
  });
  const fin = inicio + 12 * 3600000;
  const proximas = citas.filter((c) => {
    const ms = Date.parse(c.fecha_hora_cita);
    return Number.isFinite(ms) && ms >= inicio && ms < fin && !esFinal(c);
  });
  const terminales = [...new Set(proximas.map((c) => c.terminal || 'SIN TERMINAL'))].sort();
  const datasets = terminales.map((t) => ({
    label: t,
    data: bloques.map((b) => proximas.filter((c) => (c.terminal || 'SIN TERMINAL') === t && Date.parse(c.fecha_hora_cita) >= b && Date.parse(c.fecha_hora_cita) < b + 7200000).length),
  }));
  return { labels, datasets, total: proximas.length, desde: new Date(inicio).toISOString(), hasta: new Date(fin).toISOString() };
}

function distribucion10Km(citas) {
  const activas = citas.filter((c) => !esFinal(c) && c.distancia_km !== null);
  const grupos = [
    ['En Pre-Gate (< 1 km)', (km) => km <= 1],
    ['Zona Enturnamiento (1 - 3 km)', (km) => km > 1 && km <= 3],
    ['Corredor Logístico (3 - 5 km)', (km) => km > 3 && km <= 5],
    ['Anillo Periférico (5 - 10 km)', (km) => km > 5],
  ];
  const labels = grupos.map(([l]) => l);
  const valores = grupos.map(([, f]) => activas.filter((c) => f(c.distancia_km)).length);
  const total = valores.reduce((a, b) => a + b, 0);
  return {
    labels, valores, total,
    estimadas: activas.filter((c) => c.distancia_estimada).length,
    items: labels.map((label, i) => ({ label, valor: valores[i], porcentaje: C.pct(valores[i], total) })),
  };
}

function percentil(valores, p) {
  const v = [...valores].sort((a, b) => a - b);
  if (!v.length) return null;
  return v[Math.min(v.length - 1, Math.ceil((p / 100) * v.length) - 1)];
}

function estadoCitas(citas) {
  const total = citas.length;
  const retrasadas = citas.filter(esRetrasada).length;
  const conEspera = citas.filter((c) => !esFinal(c));
  const terminales = [...new Set(citas.map((c) => c.terminal).filter(Boolean))];
  return {
    totalCitas: total,
    atendidas: citas.filter(esAtendida).length,
    enCola: citas.filter(esCola).length,
    retrasadas,
    retenidos: citas.filter(esRetenida).length,
    cumplimientoPct: total > 0 ? Math.round(((total - retrasadas) / total) * 100) : 0,
    esperaPromedioMin: conEspera.length ? Math.round(C.suma(conEspera, (c) => c.tiempo_espera_minutos) / conEspera.length) : 0,
    umbrales: UMBRALES_ESPERA,
    porTerminal: terminales.map((t) => {
      const lista = conEspera.filter((c) => c.terminal === t);
      const esperas = lista.map((c) => c.tiempo_espera_minutos);
      return {
        terminal: t, citas: citas.filter((c) => c.terminal === t).length, activas: lista.length,
        esperaPromedioMin: lista.length ? Math.round(C.suma(esperas) / lista.length) : null,
        esperaP90Min: percentil(esperas, 90),
      };
    }).sort((a, b) => b.citas - a.citas || a.terminal.localeCompare(b.terminal)),
  };
}

function validacion(citas) {
  const activas = citas.filter((c) => !esFinal(c));
  const flags = (c) => [c.validacion_ocr, c.validacion_biometria, c.validacion_documental];
  const listos = activas.filter((c) => flags(c).every((f) => f === true)).length;
  const observados = activas.filter((c) => flags(c).some((f) => f === false)).length;
  const sinDato = activas.filter((c) => !flags(c).some((f) => f === false) && flags(c).some((f) => f === null)).length;
  const porTipo = (campo) => ({
    aprobadas: activas.filter((c) => c[campo] === true).length,
    fallidas: activas.filter((c) => c[campo] === false).length,
    sinDato: activas.filter((c) => c[campo] === null).length,
  });
  const conDato = listos + observados;
  return {
    totalEvaluados: activas.length,
    totalFlujo: activas.length,
    listosIngreso: listos,
    validados: listos,
    observados,
    retenidos: observados,
    sinDato,
    enCola: activas.filter(esCola).length,
    tasaAprobacionPct: conDato > 0 ? Math.round((listos / conDato) * 100) : null,
    porTipo: { ocr: porTipo('validacion_ocr'), biometria: porTipo('validacion_biometria'), documental: porTipo('validacion_documental') },
    ultimosRegistros: activas.slice(0, 8),
  };
}

function alertas(citas) {
  const lista = citas
    .filter((c) => !esFinal(c) && c.tiempo_espera_minutos >= UMBRALES_ESPERA.atencion)
    .sort((a, b) => b.tiempo_espera_minutos - a.tiempo_espera_minutos)
    .map((c) => {
      const critica = c.tiempo_espera_minutos >= UMBRALES_ESPERA.critico;
      return {
        id: `ALT-${c.id_cita}`,
        severidad: critica ? 'CRITICA' : 'ATENCION',
        tipo: 'TIEMPO DE ESPERA EXCEDIDO',
        placa: c.placa,
        terminal: c.terminal,
        minutos: c.tiempo_espera_minutos,
        mensaje: `Unidad ${c.placa || 'sin placa'} lleva ${c.tiempo_espera_minutos} min${c.ubicacion ? ` en ${c.ubicacion}` : ''}.`,
        timestamp: c.fecha_hora_cita,
      };
    });
  return { lista: lista.slice(0, MAX_ALERTAS), total: lista.length, criticas: lista.filter((a) => a.severidad === 'CRITICA').length };
}

/**
 * @param {{ filas: object[], infoBodegas?: object, puerto: string, fuente?: string }} entrada
 * @param {Date} [ahora]
 */
function armarVirtualGate({ filas = [], infoBodegas = null, puerto, fuente = 'TCL_CitasVirtualGate' }, ahora = new Date()) {
  const ahoraMs = ahora.getTime();
  const todas = (filas || []).map((r, i) => normalizarCita(r, i, puerto));
  const citas = enVentana(todas, ahoraMs);
  const conImputados = citas.filter((c) => c.imputados.length).length;
  const fueraDeVentana = todas.length - citas.length;
  const al = alertas(citas);

  return {
    resumen: resumenKpis(citas, infoBodegas),
    citas,
    citas12h: citasProximas12h(citas, ahoraMs),
    distribucion10km: distribucion10Km(citas),
    estadoCitas: estadoCitas(citas),
    validacion: validacion(citas),
    alertas: al.lista,
    totalAlertas: al.total,
    alertasCriticas: al.criticas,
    origen: origen({
      fuente,
      simulado: citas.some((c) => c.simulado),
      periodo: `Citas de las últimas ${VENTANA.atrasHoras} h y las próximas ${VENTANA.adelanteHoras} h`,
      nota: [
        conImputados ? `${conImputados} citas con campos sin dato` : null,
        citas.some((c) => c.distancia_estimada) ? 'distancias estimadas por la ubicación' : null,
        fueraDeVentana ? `${fueraDeVentana} citas fuera de la ventana no se cuentan` : null,
      ],
    }, ahora),
  };
}

module.exports = {
  UMBRALES_ESPERA, VENTANA, normalizarCita, enVentana, franjaHoraria, estimarDistancia,
  citasProximas12h, distribucion10Km, estadoCitas, validacion, alertas, armarVirtualGate,
};
