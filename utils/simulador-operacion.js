/*
    Author: German Valencia
    Pattern: PORTTOS Núcleo puro (AD-16) - Simulador de operación portuaria (granel, Ro-Ro, carga suelta, capacidad)
    Description: Sin base de datos ni red; lo usan simulador-operacion.service.js y las pruebas.
      Mientras las terminales no envían datos por la ingesta, genera operación verosímil y marcada como simulada:
        - granel: 2 a 4 motonaves; avanzan con el rendimiento de los equipos asignados (aspiradores, grúas, cintas);
        - Ro-Ro: un buque descargando a 1,8-2,6 vehículos por minuto y otros programados; lo descargado entra a patio;
        - patios de vehículos: salen niñeras hacia el interior; exportación entra y sale;
        - carga suelta: folios de break-bulk y project cargo que cambian de estado con el tiempo;
        - capacidad: ocupación de cada nodo con una caminata acotada alrededor de un nivel propio del nodo.
      Todo con rng() inyectable para probarlo con una semilla.
*/

const PRODUCTOS_GRANEL = Object.freeze({
  AGRICOLA: ['Maíz', 'Trigo', 'Soya', 'Cebada', 'Torta de soya'],
  MINERAL: ['Clinker', 'Fertilizante NPK', 'Carbón', 'Urea'],
  LIQUIDO: ['Aceite de palma', 'Melaza', 'Químicos'],
});
const MOTONAVES_GRANEL = ['PACIFIC HARVEST', 'ANDES BULKER', 'MAR DEL SUR', 'GRAIN STAR', 'CORDILLERA', 'OCEAN TRADER', 'SANTA LUCIA', 'BLUE PELICAN', 'AURORA BULK', 'CAPE CONDOR'];
const MOTONAVES_RORO = [['MORNING CAROLINE', 'EUKOR'], ['GRANDE COLOMBIA', 'Grimaldi'], ['HOEGH TRADER', 'Höegh'], ['GLOVIS SUNRISE', 'Hyundai Glovis'], ['TONSBERG', 'Wallenius Wilhelmsen']];
const MARCAS = ['Renault', 'Hyundai', 'Kia', 'Chevrolet', 'Mazda', 'Toyota', 'BYD', 'MG'];
const PRODUCTOS_SUELTA = [['Acero estructural', 'Acerías Paz del Río'], ['Bobinas de papel', 'Smurfit Kappa'], ['Cátodos de cobre', 'Centelsa'], ['Madera aserrada', 'Pizano'], ['Tubería de acero', 'Tenaris']];
const PROYECTOS = [['Generador eléctrico', 'Grúa 100 t', 42], ['Aspas eólicas', 'Tráiler extensible', 18], ['Reactor industrial', 'Grúa 200 t', 85], ['Bulldozer', 'Cama baja', 38], ['Transformador 138 kV', 'SPMT', 120]];
const EQUIPOS_BASE = Object.freeze([
  ['ASP-01', 'ASPIRADOR', 'Aspirador neumático', 320], ['ASP-02', 'ASPIRADOR', 'Aspirador neumático', 305],
  ['ASP-03', 'ASPIRADOR', 'Aspirador neumático', 300], ['LIE-01', 'GRUA_MOVIL', 'Grúa móvil LHM 550', 480],
  ['LIE-02', 'GRUA_MOVIL', 'Grúa móvil LHM 420', 410], ['LIE-03', 'GRUA_MOVIL', 'Grúa móvil LHM 420', 400],
  ['CIN-01', 'CINTA', 'Cinta transportadora', 620], ['CIN-02', 'CINTA', 'Cinta transportadora', 600],
  ['VOL-01', 'VOLQUETA', 'Volqueta 18 m³', null], ['VOL-02', 'VOLQUETA', 'Volqueta 18 m³', null],
]);
const PARAMETROS = Object.freeze({
  operacionesGranel: [2, 4], toneladasGranel: [15000, 50000], esperaFondeoMin: [60, 240],
  equiposPorOperacion: [2, 3], factorRendimiento: [0.75, 1.05],
  vehiculosRoro: [800, 2200], ritmoRoroUdsMin: [1.8, 2.6], salidaPatioPorHora: [0.01, 0.025],
  foliosBreakBulk: 7, proyectos: 5,
});

const entre = (rng, a, b) => a + (b - a) * rng();
const entero = (rng, a, b) => Math.floor(entre(rng, a, b + 1));
const elegir = (rng, lista) => lista[Math.floor(rng() * lista.length) % lista.length];
const iso = (ms) => new Date(ms).toISOString();
const horaDe = (ms) => iso(ms - (ms % 3600000));
function hashTexto(t, sal = 0) {
  let h = 2166136261 ^ sal;
  for (const ch of String(t)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return ((h >>> 0) % 100000) / 100000;
}

/** Catálogo de equipos simulados para un puerto. */
const equiposIniciales = (terminal) => EQUIPOS_BASE.map(([codigo, tipo, descripcion, tmh]) => ({
  codigo_equipo: codigo, tipo, descripcion, terminal, segmento: 'GRANEL', capacidad_tmh: tmh, estado: 'LIBRE',
}));

/** Nueva operación de granel (llega fondeada; empieza a operar después de la espera). */
function nuevaOperacionGranel(rng, ahoraMs, terminales, n) {
  const tipo = elegir(rng, ['AGRICOLA', 'AGRICOLA', 'AGRICOLA', 'MINERAL', 'MINERAL', 'LIQUIDO']);
  const total = Math.round(entre(rng, ...PARAMETROS.toneladasGranel) / 100) * 100;
  return {
    motonave: elegir(rng, MOTONAVES_GRANEL), terminal: elegir(rng, terminales), segmento: 'GRANEL', tipo,
    producto: elegir(rng, PRODUCTOS_GRANEL[tipo]), sentido: tipo === 'MINERAL' && rng() < 0.3 ? 'EXPORTACION' : 'IMPORTACION',
    unidad: 'TM', cantidad_total: total, cantidad_operada: 0, estado: 'FONDEADA',
    eta: iso(ahoraMs), fecha_inicio: iso(ahoraMs + entre(rng, ...PARAMETROS.esperaFondeoMin) * 60000),
    codigo_externo: `SIM-GRA-${ahoraMs}-${n}`,
  };
}

/** Nuevo buque Ro-Ro programado. */
function nuevaOperacionRoro(rng, ahoraMs, terminales, n, horasHastaEta) {
  const [motonave, naviera] = elegir(rng, MOTONAVES_RORO);
  return {
    motonave, naviera, terminal: elegir(rng, terminales), segmento: 'RORO', tipo: 'VEHICULOS',
    producto: `${elegir(rng, MARCAS)} / ${elegir(rng, MARCAS)}`, sentido: 'IMPORTACION', unidad: 'UNIDADES',
    cantidad_total: entero(rng, ...PARAMETROS.vehiculosRoro), cantidad_operada: 0, estado: 'PROGRAMADA',
    eta: iso(ahoraMs + horasHastaEta * 3600000), fecha_inicio: iso(ahoraMs + horasHastaEta * 3600000),
    codigo_externo: `SIM-RORO-${ahoraMs}-${n}`,
  };
}

/**
 * Avanza una operación dtHoras. Muta la operación y devuelve lo operado en el intervalo.
 * rendimientoHora: t/h (granel, suma de los equipos) o vehículos/h (Ro-Ro).
 */
function avanzarOperacion(op, dtHoras, rendimientoHora, ahoraMs) {
  if (op.estado === 'TERMINADA') return 0;
  if ((op.estado === 'FONDEADA' || op.estado === 'PROGRAMADA') && Date.parse(op.fecha_inicio) <= ahoraMs) op.estado = 'OPERANDO';
  if (op.estado !== 'OPERANDO' || rendimientoHora <= 0) return 0;
  const restante = Number(op.cantidad_total) - Number(op.cantidad_operada);
  const operado = Math.min(restante, rendimientoHora * dtHoras);
  op.cantidad_operada = Number(op.cantidad_operada) + operado;
  if (op.cantidad_operada >= Number(op.cantidad_total) - 0.5) {
    op.cantidad_operada = Number(op.cantidad_total);
    op.estado = 'TERMINADA';
    op.fecha_fin = iso(ahoraMs);
  }
  return op.unidad === 'UNIDADES' ? Math.round(operado) : Math.round(operado * 10) / 10;
}

/** Nuevos folios de carga suelta. */
function nuevoFolioBreakBulk(rng, ahoraMs, n, motonave) {
  const [producto, cliente] = elegir(rng, PRODUCTOS_SUELTA);
  const bultos = entero(rng, 40, 400);
  return {
    folio: `BB-${String(ahoraMs).slice(-5)}${n}`, clase: 'BREAK_BULK', producto, cliente, motonave, sentido: 'IMPORTACION',
    bultos, bultos_recibidos: 0, tm: Math.round(bultos * entre(rng, 2, 12)), estado: 'PROGRAMADO',
    ubicacion: 'Muelle', requiere_permiso: false, fecha_programada: iso(ahoraMs + entero(rng, 1, 8) * 3600000),
    codigo_externo: `SIM-BB-${ahoraMs}-${n}`,
  };
}
function nuevoProyecto(rng, ahoraMs, n, motonave) {
  const [producto, equipo, peso] = elegir(rng, PROYECTOS);
  const requiere = peso >= 40 || /Aspas/.test(producto);
  return {
    folio: `PR-${String(ahoraMs).slice(-5)}${n}`, clase: 'PROJECT_CARGO', producto, cliente: elegir(rng, ['Ecopetrol', 'ISA', 'EPM', 'Drummond', 'Celsia']),
    motonave, sentido: rng() < 0.85 ? 'IMPORTACION' : 'EXPORTACION', bultos: 1, bultos_recibidos: 0, tm: peso,
    peso_unitario_tm: peso, equipo_requerido: equipo, ubicacion: 'Muelle', requiere_permiso: requiere,
    permiso_aprobado: requiere ? false : null, estado: 'PROGRAMADO', fecha_programada: iso(ahoraMs + entero(rng, 1, 12) * 3600000),
    codigo_externo: `SIM-PR-${ahoraMs}-${n}`,
  };
}

/** Siguiente estado de un folio de carga suelta (avanza con el tiempo). Muta el folio. */
function avanzarFolio(f, ahoraMs, rng) {
  if (f.estado === 'PROGRAMADO' && Date.parse(f.fecha_programada) <= ahoraMs) f.estado = 'EN_DESCARGA';
  if (f.estado === 'EN_DESCARGA') {
    f.bultos_recibidos = Math.min(f.bultos, (f.bultos_recibidos || 0) + Math.max(1, Math.round(f.bultos * entre(rng, 0.05, 0.15))));
    if (f.bultos_recibidos >= f.bultos) {
      f.estado = f.requiere_permiso && !f.permiso_aprobado ? 'ESPERA_PERMISO' : 'EN_PATIO';
      f.ubicacion = f.clase === 'PROJECT_CARGO' ? 'Patio project cargo' : 'Patio break-bulk Norte';
    }
  } else if (f.estado === 'ESPERA_PERMISO' && rng() < 0.08) {
    f.permiso_aprobado = true; f.estado = 'EN_PATIO';
  } else if (f.estado === 'EN_PATIO' && rng() < 0.05) {
    f.estado = 'DESPACHADO'; f.ubicacion = 'Despachado al interior';
  }
  return f;
}

/** Ocupación siguiente de un nodo: caminata acotada hacia su nivel propio (estable por nodo). */
function siguienteOcupacion(idNodo, actualPct, rng) {
  const nivel = 45 + hashTexto(idNodo) * 50;                     // 45 % a 95 %
  const previo = Number.isFinite(actualPct) ? actualPct : nivel;
  const paso = (nivel - previo) * 0.15 + entre(rng, -2.5, 2.5);
  return Math.max(5, Math.min(100, Math.round((previo + paso) * 10) / 10));
}

/** Tráfico de entrada y salida por hora según la categoría y la ocupación. */
function traficoNodo(categoria, ocupacionPct, rng) {
  const base = { TERMINAL: 40, PATIO_CONTENEDOR: 16, DEPOT_VACIOS: 9, PATIO_PDI: 8, PATIO_BREAKBULK: 3 }[categoria] ?? 10;
  const ingresos = Math.max(0, Math.round(base * entre(rng, 0.7, 1.3)));
  const salidas = Math.max(0, Math.round(base * entre(rng, 0.7, 1.3) * (ocupacionPct > 85 ? 1.15 : 1)));
  const espera = Math.round(ocupacionPct >= 90 ? entre(rng, 12, 25) : ocupacionPct >= 80 ? entre(rng, 5, 12) : entre(rng, 0, 5));
  return { ingresos_h: ingresos, salidas_h: salidas, espera_min: espera };
}

module.exports = {
  PARAMETROS, MARCAS, entre, entero, elegir, hashTexto, horaDe,
  equiposIniciales, nuevaOperacionGranel, nuevaOperacionRoro, avanzarOperacion,
  nuevoFolioBreakBulk, nuevoProyecto, avanzarFolio, siguienteOcupacion, traficoNodo,
};
