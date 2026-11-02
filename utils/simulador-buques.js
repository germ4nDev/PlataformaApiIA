/*
    Author: German Valencia
    Pattern: PORTTOS Núcleo puro (AD-16) - Simulador de buques (OT-009, 2026-10-29)
    Description: Sin base de datos ni red; lo usan simulador-operacion.service.js y las pruebas.
      Decisión del usuario (2026-10-29): mientras el AIS no reporte en Colombia se simulan buques en el mapa, rotulados.
        - Rótulo: el nombre lleva el prefijo 'SIM · ' y el MMSI empieza por 'SIM' (nunca choca con un MMSI real), así se ve
          como simulado en web, app, mapa y tablas sin tocar el front.
        - Escalas reproducibles: llegadas por día (semilla puerto + día) según los muelles del puerto; cada nave espera en
          fondeo hasta que su muelle queda libre (cola real por muelle) y luego atraca; la estadía depende del tipo de nave.
        - A la hora dada salen: posiciones (fondeadas en el punto de fondeo del maestro con una dispersión de ~1 km,
          atracadas en su muelle), eventos de cambio de estado de los últimos días (espera en fondeo y estadía) y avisos
          de arribo de las próximas 72 h (como los de DIMAR).
      Todo va con fuente SIMULADOR y simulado = 1 (lo pone el servicio).
*/
const { rngDe, hash32 } = require('./simulador-gate');

const HORA = 3600000;
const DIA = 24 * HORA;
const PREFIJO = 'SIM · ';
const PARAMETROS = Object.freeze({
  diasHistoria: 10, horasAvisos: 72, horasAvisosAtras: 12,
  llegadasPorMuelleDia: 0.4, minLlegadasDia: 1, maxLlegadasDia: 10,
  esperaMinimaH: [3, 20],            // fondeo mínimo (práctico, documentos, marea) aunque el muelle esté libre
  margenAfinH: 12,                   // cuánto más espera una nave por un muelle de su especialidad antes de tomar otro
});
const TIPOS = Object.freeze([
  // tipo_nave, estadía [h], eslora [m], calado [m], especialidad del muelle que prefiere
  ['TRANSPORTADOR DE CONTAINERS', [14, 30], [180, 300], [10, 14], /CONT/i],
  ['GRANELERO', [30, 72], [170, 230], [10, 13], /GRAN/i],
  ['CARGA GENERAL', [20, 48], [110, 170], [7, 10], /GENERAL|MULTI/i],
  ['TANQUERO', [18, 36], [150, 250], [9, 14], /LIQ|TANQ|HIDRO|PETRO/i],
  ['TRANSPORTADOR DE VEHICULOS', [12, 24], [180, 200], [8, 10], /RORO|VEH/i],
]);
const NOMBRES = ['PACIFIC HARVEST', 'ANDES BULKER', 'MAR DEL SUR', 'GRAIN STAR', 'CORDILLERA', 'OCEAN TRADER', 'SANTA LUCIA', 'BLUE PELICAN',
  'AURORA BULK', 'CAPE CONDOR', 'CARIBBEAN WAVE', 'NORTHERN SPIRIT', 'MAGDALENA', 'SIERRA NEVADA', 'GOLDEN EAGLE', 'LIBERTAD', 'POLAR MIST',
  'SOUTHERN CROSS', 'EVER BRAVE', 'ATLANTIC PRIDE', 'URABA STAR', 'TAYRONA', 'GALEON', 'ISLA FUERTE'];
const BANDERAS = ['PANAMA', 'LIBERIA', 'ISLAS MARSHALL', 'MALTA', 'SINGAPUR', 'BAHAMAS', 'COLOMBIA'];
const AGENCIAS = ['Agencia Marítima del Pacífico', 'Navemar', 'Transmares', 'Representaciones Marítimas', 'Agencia Naviera del Caribe'];

const entre = (rng, a, b) => a + (b - a) * rng();
const entero = (rng, a, b) => Math.floor(entre(rng, a, b + 1));
const elegir = (rng, lista) => lista[Math.floor(rng() * lista.length) % lista.length];
const iso = (ms) => new Date(ms).toISOString();
const inicioDia = (ms) => ms - (((ms % DIA) + DIA) % DIA);

/**
 * Escalas del puerto (llegada, atraque, zarpe) desde 'diasHistoria' días atrás hasta 72 h adelante, con cola por muelle.
 * @param {string} clave  puerto (semilla)
 * @param {{ idTerminal:string, terminal?:string, codigoMuelle:string, especialidad?:string }[]} muelles
 */
function escalas(clave, muelles, ahoraMs, p = PARAMETROS) {
  if (!muelles.length) return [];
  const desde = inicioDia(ahoraMs) - p.diasHistoria * DIA;
  const hasta = ahoraMs + p.horasAvisos * HORA;
  const libre = new Map(muelles.map((m) => [`${m.idTerminal}|${m.codigoMuelle}`, desde]));
  const porDia = Math.max(p.minLlegadasDia, Math.min(p.maxLlegadasDia, muelles.length * p.llegadasPorMuelleDia));
  const lista = [];
  for (let dia = desde; dia < hasta; dia += DIA) {
    const rng = rngDe(`${clave}|buques|${iso(dia).slice(0, 10)}`);
    const n = Math.max(0, Math.round(porDia * entre(rng, 0.6, 1.4)));
    const delDia = [];
    for (let i = 0; i < n; i++) {
      const [tipo, estadia, eslora, calado, especialidad] = elegir(rng, TIPOS);
      delDia.push({
        llegada: dia + Math.floor(entre(rng, 0, 24) * HORA), tipo, especialidad,
        estadiaH: entre(rng, ...estadia), eslora: Math.round(entre(rng, ...eslora)), calado: Math.round(entre(rng, ...calado) * 10) / 10,
        esperaMinH: entre(rng, ...p.esperaMinimaH), nombre: elegir(rng, NOMBRES), bandera: elegir(rng, BANDERAS),
        agencia: elegir(rng, AGENCIAS), n: i, dia,
      });
    }
    delDia.sort((a, b) => a.llegada - b.llegada);
    for (const e of delDia) {
      // Muelle: el que quede libre primero entre los de su especialidad; si otro cualquiera queda libre más de
      // MARGEN_AFIN_H antes, ese (así una especialidad con pocos muelles no arma una cola de días)
      const primero = (lista) => lista.reduce((a, b) => (libre.get(`${b.idTerminal}|${b.codigoMuelle}`) < libre.get(`${a.idTerminal}|${a.codigoMuelle}`) ? b : a));
      const afines = muelles.filter((m) => e.especialidad.test(m.especialidad || ''));
      const cualquiera = primero(muelles);
      const afin = afines.length ? primero(afines) : cualquiera;
      const libreDe = (m) => libre.get(`${m.idTerminal}|${m.codigoMuelle}`);
      const muelle = libreDe(afin) - libreDe(cualquiera) > p.margenAfinH * HORA ? cualquiera : afin;
      const k = `${muelle.idTerminal}|${muelle.codigoMuelle}`;
      const atraque = Math.max(e.llegada + e.esperaMinH * HORA, libre.get(k));
      const zarpe = atraque + e.estadiaH * HORA;
      libre.set(k, zarpe + HORA);                                      // una hora entre zarpe y el siguiente atraque
      const codigo = String(hash32(`${clave}|${e.dia}|${e.n}`)).padStart(6, '0').slice(-6);
      lista.push({
        mmsi: `SIM${codigo}`, idAviso: `SIM-${clave.slice(0, 4)}-${codigo}`, nombre: `${PREFIJO}${e.nombre} ${codigo.slice(-3)}`, tipo: e.tipo,   // sufijo único: el mapa cruza AIS y avisos por nombre
        eslora: e.eslora, calado: e.calado, bandera: e.bandera, agencia: e.agencia,
        idTerminal: muelle.idTerminal, terminal: muelle.terminal || muelle.idTerminal, codigoMuelle: muelle.codigoMuelle,
        latMuelle: muelle.lat ?? null, lonMuelle: muelle.lon ?? null,
        llegada: e.llegada, atraque, zarpe,
      });
    }
  }
  return lista;
}

/** Posición y estado de cada nave que está en el puerto a la hora dada (filas de TCL_AisUltimaPosicion). */
function posiciones(clave, lista, fondeo, ahoraMs) {
  const filas = [];
  for (const e of lista) {
    if (e.llegada > ahoraMs || e.zarpe <= ahoraMs) continue;
    const atracada = e.atraque <= ahoraMs;
    let lat; let lon;
    if (atracada) { lat = e.latMuelle; lon = e.lonMuelle; } else if (fondeo) {
      // Dispersión estable de ~1 km alrededor del punto de fondeo (cada nave en su sitio)
      const r = rngDe(`${clave}|${e.mmsi}|fondeo`);
      lat = fondeo.lat + entre(r, -0.009, 0.009); lon = fondeo.lon + entre(r, -0.009, 0.009);
    }
    if (lat === null || lat === undefined || lon === null || lon === undefined) continue;   // sin dónde dibujarla
    filas.push({
      mmsi: e.mmsi, nombre_motonave: e.nombre, latitud: Math.round(lat * 1e6) / 1e6, longitud: Math.round(lon * 1e6) / 1e6,
      velocidad: atracada ? 0 : 0.2, rumbo: atracada ? null : (hash32(e.mmsi) % 360), destino: clave,
      estado_inferido: atracada ? 'ATRACADO' : 'FONDEADO', estado_nav_ais: atracada ? 5 : 1,
      id_terminal: atracada ? e.idTerminal : null, codigo_muelle: atracada ? e.codigoMuelle : null,
      fecha_cambio_estado: iso(atracada ? e.atraque : e.llegada),
    });
  }
  return filas;
}

/** Fondeadas sin punto de fondeo: igual cuentan (cola, tiempos) aunque no se dibujen. */
function fondeadasSinPosicion(lista, fondeo, ahoraMs) {
  return fondeo ? 0 : lista.filter((e) => e.llegada <= ahoraMs && e.atraque > ahoraMs).length;
}

/** Eventos de cambio de estado ya ocurridos (filas de TCL_EventosEstadoNave). */
function eventos(lista, ahoraMs) {
  const filas = [];
  for (const e of lista) {
    const base = { mmsi: e.mmsi, nombre_motonave: e.nombre };
    if (e.llegada <= ahoraMs) filas.push({ ...base, estado_anterior: 'NAVEGANDO', estado_nuevo: 'FONDEADO', duracion_anterior_min: null, fecha_evento: iso(e.llegada), id_terminal: null, codigo_muelle: null });
    if (e.atraque <= ahoraMs) filas.push({ ...base, estado_anterior: 'FONDEADO', estado_nuevo: 'ATRACADO', duracion_anterior_min: Math.round((e.atraque - e.llegada) / 60000), fecha_evento: iso(e.atraque), id_terminal: e.idTerminal, codigo_muelle: e.codigoMuelle });
    if (e.zarpe <= ahoraMs) filas.push({ ...base, estado_anterior: 'ATRACADO', estado_nuevo: 'NAVEGANDO', duracion_anterior_min: Math.round((e.zarpe - e.atraque) / 60000), fecha_evento: iso(e.zarpe), id_terminal: e.idTerminal, codigo_muelle: e.codigoMuelle });
  }
  return filas.sort((a, b) => a.fecha_evento.localeCompare(b.fecha_evento));
}

/** Avisos de arribo (como los de DIMAR) de las naves que aún no llegan, con ETA en [−12 h, +72 h] (TCL_NavesAvisadas). */
function avisos(lista, capitania, ahoraMs, p = PARAMETROS) {
  return lista
    .filter((e) => e.llegada > ahoraMs - p.horasAvisosAtras * HORA && e.llegada <= ahoraMs + p.horasAvisos * HORA && e.llegada > ahoraMs)
    .map((e) => ({
      capitania, id_aviso: e.idAviso, omi: null, motonave: e.nombre, bandera: e.bandera, eta: iso(e.llegada), tipo_nave: e.tipo,
      eslora: e.eslora, calado: e.calado, agencia: e.agencia, instalacion_portuaria: e.terminal, id_terminal: e.idTerminal,
    }));
}

const TRABAJO = Object.freeze({
  'TRANSPORTADOR DE CONTAINERS': 'DESCARGA / CARGUE CONTENEDORES', GRANELERO: 'DESCARGA GRANEL', 'CARGA GENERAL': 'DESCARGA CARGA GENERAL',
  TANQUERO: 'DESCARGA GRANEL LIQUIDO', 'TRANSPORTADOR DE VEHICULOS': 'DESCARGA VEHICULOS RO-RO',
});

/**
 * Line-up del puerto (filas de TCL_LineUpMaritimo): las mismas escalas, con zarpe en las últimas 24 h o llegada en las
 * próximas 72 h. La posición sigue al reloj (ESPERADO → FONDEO → ATRACADO → ZARPADO) y el trabajo solo se escribe mientras
 * la nave está atracada, para que la tabla no diga «descargando» de una nave que aún no llega.
 */
function lineUp(lista, ahoraMs, p = PARAMETROS) {
  return lista
    .filter((e) => e.zarpe >= ahoraMs - 24 * HORA && e.llegada <= ahoraMs + p.horasAvisos * HORA)
    .map((e) => {
      const posicion = e.zarpe <= ahoraMs ? 'ZARPADO' : e.atraque <= ahoraMs ? 'ATRACADO' : e.llegada <= ahoraMs ? 'FONDEO' : 'ESPERADO';
      return {
        terminal: e.idTerminal, muelle: e.codigoMuelle, motonave: e.nombre, lineaAgencia: e.agencia, viaje: e.mmsi.slice(3),
        eslora: e.eslora, eta: iso(e.llegada), fechaAtraque: iso(e.atraque), fechaZarpe: iso(e.zarpe),
        trabajoOperacion: posicion === 'ATRACADO' ? TRABAJO[e.tipo] : null, posicion, novedades: e.tipo,
      };
    });
}

// Movimientos por hora de una nave atracada según su tipo (contenedores en movimientos de grúa; el resto en movimientos de
// equipo de muelle). Es una referencia para que la gráfica tenga la forma de un turno real, rotulada SIMULADO.
const RITMO = Object.freeze({ 'TRANSPORTADOR DE CONTAINERS': [22, 34], GRANELERO: [10, 18], 'CARGA GENERAL': [8, 14], TANQUERO: [6, 10], 'TRANSPORTADOR DE VEHICULOS': [14, 22] });
const horaCol = (ms) => new Date(ms - 5 * HORA).getUTCHours();
const diaCol = (ms) => new Date(ms - 5 * HORA).toISOString().slice(0, 10);
const fechaCorta = (ms) => { const d = new Date(ms - 5 * HORA); return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };

/**
 * Productividad de hoy (filas de TCL_ProductividadTerminales): por terminal y hora de Colombia, la suma de los movimientos de
 * las naves atracadas en esa hora (fracción de la hora que estuvieron). Las terminales del puerto sin nave salen en 0.
 */
function productividad(lista, terminales, ahoraMs) {
  const col = ahoraMs - 5 * HORA;
  const inicio = col - (((col % DIA) + DIA) % DIA) + 5 * HORA;              // 00:00 de hoy en Colombia
  const filas = [];
  const ids = [...new Set([...(terminales || []).map((t) => t.idTerminal ?? t.id_terminal), ...lista.map((e) => e.idTerminal)].filter(Boolean))];
  for (let h = inicio; h <= ahoraMs; h += HORA) {                            // la hora en curso va parcial
    for (const t of ids) {
      let movs = 0;
      for (const e of lista) {
        if (e.idTerminal !== t) continue;
        const dentro = Math.max(0, Math.min(h + HORA, e.zarpe, ahoraMs) - Math.max(h, e.atraque)) / HORA;
        if (dentro <= 0) continue;
        const r = rngDe(`${e.mmsi}|${h}`);
        const [a, b] = RITMO[e.tipo] || [8, 14];
        const turno = [6, 7, 13, 18, 19].includes(horaCol(h)) ? 0.7 : 1;   // cambios de turno y almuerzo
        movs += dentro * entre(r, a, b) * turno;
      }
      filas.push({ terminal: t, fecha: diaCol(ahoraMs), hora_etiqueta: `${String(horaCol(h)).padStart(2, '0')}:00`, movimientos_hora: Math.round(movs) });
    }
  }
  return filas;
}

/**
 * Reportes operativos (filas de TCL_ReportesOperativos) con los hechos de las escalas: atraques y zarpes de las últimas
 * 24 h, esperas en fondeo de más de 24 h y arribos de las próximas 6 h. Del más antiguo al más reciente (así el último
 * insertado, el de mayor id, es el más nuevo: el tablero lee TOP 5 por id).
 */
function reportes(lista, ahoraMs, max = 12) {
  const r = [];
  for (const e of lista) {
    const donde = `muelle ${e.codigoMuelle} · ${e.terminal}`;
    if (e.atraque <= ahoraMs && e.atraque > ahoraMs - DIA) r.push([e.atraque, `Atraque · ${e.nombre}`, `${e.tipo.toLowerCase()} atracó en ${donde} tras ${Math.round((e.atraque - e.llegada) / HORA)} h en fondeo.`, 'verde', '⚓']);
    if (e.zarpe <= ahoraMs && e.zarpe > ahoraMs - DIA) r.push([e.zarpe, `Zarpe · ${e.nombre}`, `Zarpó de ${donde} después de ${Math.round((e.zarpe - e.atraque) / HORA)} h de operación.`, 'azul', '🚢']);
    if (e.llegada <= ahoraMs && e.atraque > ahoraMs && ahoraMs - e.llegada > DIA) r.push([ahoraMs - 60000, `Espera prolongada · ${e.nombre}`, `Lleva ${Math.round((ahoraMs - e.llegada) / HORA)} h en fondeo esperando ${donde}.`, 'rojo', '⏳']);
    if (e.llegada > ahoraMs && e.llegada <= ahoraMs + 6 * HORA) r.push([ahoraMs - 120000, `Arribo próximo · ${e.nombre}`, `ETA ${fechaCorta(e.llegada)} (hora de Colombia), asignada a ${donde}.`, 'amarillo', '📡']);
  }
  return r.sort((a, b) => a[0] - b[0]).slice(-max).map(([ms, titulo, descripcion, tipo_color, icono]) => ({
    titulo: titulo.slice(0, 150), descripcion, tipo_color, icono, fecha_evento: fechaCorta(ms), fecha_registro: iso(ms),
  }));
}

module.exports = { PREFIJO, PARAMETROS, TIPOS, escalas, posiciones, fondeadasSinPosicion, eventos, avisos, lineUp, productividad, reportes };
