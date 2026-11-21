/*
    Author: German Valencia
    Pattern: PORTTOS Núcleo puro (AD-16) - Reglas de alertas del mapa
    Description: Decide QUÉ alertar a partir de datos ya leídos (flota, peajes, eventos viales, geocercas,
      ocupación, AIS, puntos de control). Sin red, sin base, sin socket: el servicio alertas-mapa orquesta, guarda y emite.
      Niveles (colores de toastr): info = azul (movimiento normal), warning = amarillo (atención),
      error = rojo (actuar).
      CATALOGO_REGLAS es la fuente única de las reglas, sus umbrales y sus valores por defecto; la tabla
      TCL_ConfigAlertas (migración 011) los ajusta, globalmente (id_puerto '*') o por puerto.
*/
const { dentroDe } = require('./osm-referencia');

const RADIO_TIERRA = 6371008.8;

/**
 * Catálogo de reglas. umbrales[i] corresponde a la columna umbral_{i+1} de TCL_ConfigAlertas.
 * porPuerto: sus umbrales se pueden ajustar por puerto (las de flota se evalúan antes de saber el puerto).
 * escala: false = solo produce alertas azules, que nunca escalan (CC-267: la pantalla no muestra el plazo de escalamiento).
 */
const CATALOGO_REGLAS = Object.freeze({
  peaje: {
    nombre: 'Camión pasa por un peaje', niveles: 'Azul', enfriamientoMin: 10, porPuerto: false, escala: false,
    umbrales: [{ etiqueta: 'Radio del peaje (m)', defecto: 300 }, { etiqueta: 'Salto máximo entre posiciones (m)', defecto: 20000 }],
  },
  geocerca: { nombre: 'Camión entra a una geocerca', niveles: 'Azul · rojo si es zona crítica', enfriamientoMin: 15, porPuerto: false, umbrales: [] },
  proximidad_evento: {
    nombre: 'Camión cerca de un evento vial', niveles: 'Amarillo · rojo si es cierre o severidad alta', enfriamientoMin: 20, porPuerto: false,
    umbrales: [{ etiqueta: 'Distancia al evento (m)', defecto: 2000 }],
  },
  ocupacion: {
    nombre: 'Ocupación de muelles por terminal', niveles: 'Amarillo · rojo', enfriamientoMin: 30, porPuerto: true,
    umbrales: [{ etiqueta: 'Amarillo desde (%)', defecto: 80 }, { etiqueta: 'Rojo desde (%)', defecto: 95 }, { etiqueta: 'Rearme por debajo de (%)', defecto: 75 }],
  },
  faro: { nombre: 'Nave entra a una zona vigilada del corredor',   // CC-280: los faros son elementos del corredor
    niveles: 'Azul', enfriamientoMin: 30, porPuerto: true, escala: false, umbrales: [] },
  atraque: { nombre: 'Nave atraca', niveles: 'Azul', enfriamientoMin: 60, porPuerto: true, escala: false, umbrales: [] },
  zarpe: { nombre: 'Nave desatraca', niveles: 'Azul', enfriamientoMin: 60, porPuerto: true, escala: false, umbrales: [] },
  ia_temprana: {
    nombre: 'Alerta temprana del analista IA', niveles: 'Rojo crítica · amarillo atención · azul informativa', enfriamientoMin: 30, porPuerto: true,
    umbrales: [],
  },
  evento_vial: {
    nombre: 'Evento vial nuevo o despejado', niveles: 'Rojo accidente o cierre · amarillo los demás · azul despejado', enfriamientoMin: 5, porPuerto: true,
    umbrales: [{ etiqueta: 'Severidad mínima para avisar uno nuevo (1 a 3)', defecto: 1 }],
  },
  fondeo: {
    nombre: 'Nave fondeada mucho tiempo', niveles: 'Amarillo · rojo', enfriamientoMin: 360, porPuerto: true,
    umbrales: [{ etiqueta: 'Amarillo desde (horas)', defecto: 12 }, { etiqueta: 'Rojo desde (horas)', defecto: 24 }],
  },
  // CC-271 · Capa de prevención: el pronóstico de ocupación (apps/porttos/utils/pronostico-muelles) dice cuándo un terminal llegaría al
  // umbral crítico de «ocupacion»; aquí cuánto antes se avisa en rojo y en amarillo. Azul = solo en el escenario alto (estadía p90).
  pronostico_muelles: {
    nombre: 'Pronóstico: muelles se saturarían', niveles: 'Rojo si falta poco · amarillo · azul si solo en el escenario alto', enfriamientoMin: 120,
    porPuerto: true,
    umbrales: [{ etiqueta: 'Rojo si faltan (horas) o menos', defecto: 2 }, { etiqueta: 'Amarillo si faltan (horas) o menos', defecto: 6 }],
  },
  // CC-290 · Prevención del gate: el pronóstico de cola (apps/porttos/utils/pronostico-gate) dice en cuántas horas la espera de un
  // terminal llegaría a crítico (umbral de espera del tablero, 45 min); aquí cuánto antes se avisa en rojo y en amarillo.
  pronostico_gate: {
    nombre: 'Pronóstico: espera crítica en el gate', niveles: 'Rojo si falta poco · amarillo', enfriamientoMin: 120, porPuerto: true,
    umbrales: [{ etiqueta: 'Rojo si faltan (horas) o menos', defecto: 1 }, { etiqueta: 'Amarillo si faltan (horas) o menos', defecto: 3 }],
  },
  // CC-293 · Prevención de patios y bodegas: el pronóstico de ocupación (apps/porttos/utils/pronostico-nodos) dice en cuántas horas un
  // patio, depot o bodega llegaría a crítico (85 %); aquí cuánto antes se avisa. Azul = solo en el escenario alto.
  pronostico_nodos: {
    nombre: 'Pronóstico: patio o bodega se saturaría', niveles: 'Rojo si falta poco · amarillo · azul si solo en el escenario alto', enfriamientoMin: 180,
    porPuerto: true,
    umbrales: [{ etiqueta: 'Rojo si faltan (horas) o menos', defecto: 4 }, { etiqueta: 'Amarillo si faltan (horas) o menos', defecto: 12 }],
  },
  // CC-238 · Los umbrales son los de cada infraestructura (pestaña «Métricas que se miden»); aquí solo el encendido y el enfriamiento.
  punto_control: {
    nombre: 'Punto de control en atención o crítico', niveles: 'Amarillo atención · rojo crítico', enfriamientoMin: 30, porPuerto: true,
    umbrales: [],
  },
});

/**
 * Configuración efectiva de una regla para un puerto: fila del puerto, si no la global ('*'), si no el catálogo.
 * @param {Array<{codigo_regla,id_puerto,activa,umbral_1,umbral_2,umbral_3,enfriamiento_min}>} filas
 * @returns {{activa:boolean, umbrales:number[], enfriamientoMs:number}}
 */
function resolverConfig(filas, regla, puerto = '*') {
  const cat = CATALOGO_REGLAS[regla];
  const defectos = (cat?.umbrales || []).map((u) => u.defecto);
  const deRegla = (filas || []).filter((f) => f.codigo_regla === regla);
  const global = deRegla.find((f) => (f.id_puerto || '*') === '*');
  const propia = puerto && puerto !== '*' ? deRegla.find((f) => f.id_puerto === puerto) : null;
  const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? undefined : Number(v));
  const umbrales = defectos.map((d, i) => num(propia?.[`umbral_${i + 1}`]) ?? num(global?.[`umbral_${i + 1}`]) ?? d);
  const activaDe = (f) => (f ? f.activa === true || f.activa === 1 || f.activa === '1' : undefined);
  const activa = activaDe(propia) ?? activaDe(global) ?? true;
  const minutos = num(propia?.enfriamiento_min) ?? num(global?.enfriamiento_min) ?? cat?.enfriamientoMin ?? 10;
  return { activa, umbrales, enfriamientoMs: minutos * 60 * 1000 };
}

// ── Geometría ────────────────────────────────────────────────────────────────
function metros(a, b) {
  const k = Math.cos(((a[1] + b[1]) / 2) * Math.PI / 180);
  return Math.hypot((a[0] - b[0]) * k, a[1] - b[1]) * Math.PI / 180 * RADIO_TIERRA;
}

/** Distancia en metros del punto p al tramo a→b. */
function distanciaATramo(p, a, b) {
  const k = Math.cos(p[1] * Math.PI / 180);
  const ax = (a[0] - p[0]) * k, ay = a[1] - p[1], bx = (b[0] - p[0]) * k, by = b[1] - p[1];
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0;
  return Math.hypot(ax + t * dx, ay + t * dy) * Math.PI / 180 * RADIO_TIERRA;
}

const esPunto = (c) => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]);
const defecto = (regla, i) => CATALOGO_REGLAS[regla].umbrales[i].defecto;

// ── Alerta estándar ──────────────────────────────────────────────────────────
/**
 * @param {{nivel:'info'|'warning'|'error', categoria:string, titulo:string, mensaje:string,
 *          coordenadas?:[number,number]|null, entidad?:string, simulado?:boolean}} a
 */
function crearAlerta(a, ahora = new Date()) {
  const entidad = a.entidad || '';
  return {
    ...(a.puertos ? { puertos: a.puertos } : {}),
    id: `${a.categoria}:${entidad}:${ahora.getTime()}`,
    nivel: a.nivel,
    categoria: a.categoria,
    titulo: a.titulo,
    mensaje: a.mensaje,
    coordenadas: esPunto(a.coordenadas) ? [Math.round(a.coordenadas[0] * 1e6) / 1e6, Math.round(a.coordenadas[1] * 1e6) / 1e6] : null,
    entidad,
    simulado: Boolean(a.simulado),
    fecha: ahora.toISOString(),
  };
}

// ── Reglas de flota ──────────────────────────────────────────────────────────

/**
 * Camiones cuyo tramo recorrido (posición anterior → actual) pasa por un peaje.
 * @param {Array<{placa:string, lon:number, lat:number}>} flota
 * @param {Map<string,[number,number]>} previas  última posición conocida por placa
 * @param {Array<{nombre:string, coordenadas:[number,number]}>} peajes
 * @param {{radio?:number, saltoMaximo?:number}} [opc]
 */
function alertasPeajes(flota, previas, peajes, ahora = new Date(), opc = {}) {
  const radio = opc.radio ?? defecto('peaje', 0), saltoMaximo = opc.saltoMaximo ?? defecto('peaje', 1);
  const alertas = [];
  flota.forEach((c) => {
    const actual = [c.lon, c.lat], antes = previas.get(c.placa);
    if (!esPunto(actual) || !esPunto(antes)) return;
    if (antes[0] === actual[0] && antes[1] === actual[1]) return;
    if (metros(antes, actual) > saltoMaximo) return; // reinicio de ruta del simulador
    let mejor = null;
    peajes.forEach((p) => {
      const d = distanciaATramo(p.coordenadas, antes, actual);
      if (d <= radio && (!mejor || d < mejor.d)) mejor = { p, d };
    });
    if (!mejor) return;
    const vel = Number(c.velocidad) > 0 ? ` · ${Math.round(c.velocidad)} km/h` : '';
    alertas.push(crearAlerta({
      nivel: 'info', categoria: 'peaje', entidad: `${c.placa}|${mejor.p.nombre}`,
      titulo: `🚛 ${c.placa} pasó un peaje`,
      mensaje: `Peaje ${mejor.p.nombre}${vel}`,
      coordenadas: mejor.p.coordenadas, simulado: true,
    }, ahora));
  });
  return alertas;
}

/**
 * Entradas a geocercas terrestres (solo transición: la placa no estaba en esa zona en el ciclo anterior).
 * @param {Array<{placa:string, Lugar:string, tipo?:string}>} enZona  resultado de detectarEventosGeocerca
 * @param {Map<string,Set<string>>} zonasPrevias  placa → zonas del ciclo anterior (se actualiza)
 * @param {Map<string,[number,number]>} posiciones  placa → posición actual
 */
function alertasGeocercas(enZona, zonasPrevias, posiciones, ahora = new Date()) {
  const actuales = new Map();
  enZona.forEach((e) => {
    if (!e.placa || !e.Lugar) return;
    if (!actuales.has(e.placa)) actuales.set(e.placa, new Map());
    actuales.get(e.placa).set(e.Lugar, e);
  });
  const alertas = [];
  actuales.forEach((zonas, placa) => {
    const antes = zonasPrevias.get(placa) || new Set();
    zonas.forEach((e, lugar) => {
      if (antes.has(lugar)) return;
      const critica = /cr[ií]tic/i.test(`${lugar} ${e.tipo || ''}`);
      alertas.push(crearAlerta({
        nivel: critica ? 'error' : 'info', categoria: 'geocerca', entidad: `${placa}|${lugar}`,
        titulo: critica ? `⛔ ${placa} entró a zona crítica` : `🚛 ${placa} ingresó a zona`,
        mensaje: lugar, coordenadas: posiciones.get(placa), simulado: true,
      }, ahora));
    });
  });
  zonasPrevias.clear();
  actuales.forEach((zonas, placa) => zonasPrevias.set(placa, new Set(zonas.keys())));
  return alertas;
}

/**
 * Camiones cerca de un evento vial activo. Cierre total, severidad alta o crítica → rojo; el resto → amarillo.
 * @param {Array<{codigoEvento:string, tipoEvento?:string, nivelSeveridad?:string, corredorVial?:string, lon:number, lat:number}>} eventos
 * @param {{distancia?:number}} [opc]
 */
function alertasProximidadEventos(flota, eventos, ahora = new Date(), opc = {}) {
  const distancia = opc.distancia ?? defecto('proximidad_evento', 0);
  const alertas = [];
  const validos = eventos.filter((e) => esPunto([Number(e.lon), Number(e.lat)]));
  flota.forEach((c) => {
    const p = [c.lon, c.lat];
    if (!esPunto(p)) return;
    let cerca = null;
    validos.forEach((e) => {
      const d = metros(p, [Number(e.lon), Number(e.lat)]);
      if (d <= distancia && (!cerca || d < cerca.d)) cerca = { e, d };
    });
    if (!cerca) return;
    const { e, d } = cerca;
    const grave = /cierre total|alta|cr[ií]tic/i.test(`${e.tipoEvento || ''} ${e.nivelSeveridad || ''}`);
    alertas.push(crearAlerta({
      nivel: grave ? 'error' : 'warning', categoria: 'proximidad_evento', entidad: `${c.placa}|${e.codigoEvento}`,
      titulo: `⚠️ ${c.placa} a ${(d / 1000).toFixed(1)} km de un evento vial`,
      mensaje: [e.tipoEvento, e.corredorVial].filter(Boolean).join(' · ') || 'Evento vial activo',
      coordenadas: [Number(e.lon), Number(e.lat)], simulado: true,
    }, ahora));
  });
  return alertas;
}

// ── Ciclo de vida de los eventos viales ──────────────────────────────────────

/**
 * Un aviso por evento nuevo (rojo si es accidente o cierre o severidad 3, amarillo los demás) y uno azul por
 * evento despejado, con lo que duró. Entrada: la salida de utils/eventos-viales.reconciliar() o un despeje manual.
 * @param {object[]} nuevos     eventos (con ubicacion_geo o lon/lat)
 * @param {object[]} resueltos  { codigoEvento, motivo, duracionMin, evento }
 * @param {{ severidadMinima?: number }} [opc]
 */
function alertasEventosViales(nuevos = [], resueltos = [], ahora = new Date(), opc = {}) {
  const EV = require('./eventos-viales');
  const minima = opc.severidadMinima ?? defecto('evento_vial', 0);
  const punto = (e) => {
    const c = e?.ubicacion_geo?.coordinates;
    return c ? [Number(c[0]), Number(c[1])] : [Number(e?.lon), Number(e?.lat)];
  };
  const lugar = (e) => [e?.corredorVial, e?.sector].filter(Boolean).join(' · ');
  const alertas = [];
  nuevos.filter((e) => (Number(e.nivelSeveridad) || 1) >= minima).forEach((e) => {
    const tipo = String(e.tipoEvento || '').toUpperCase();
    const grave = tipo === 'ACCIDENTE' || tipo === 'CIERRE_VIAL' || Number(e.nivelSeveridad) >= 3;
    alertas.push(crearAlerta({
      nivel: grave ? 'error' : 'warning', categoria: 'evento_vial', entidad: `${e.codigoEvento}|nuevo`,
      titulo: `🚧 ${EV.nombreTipo(tipo)} en ${e.corredorVial || 'la vía'}`,
      mensaje: lugar(e) || 'Evento vial reportado', coordenadas: punto(e),
    }, ahora));
  });
  resueltos.forEach((r) => {
    const e = r.evento || {};
    const duracion = EV.textoDuracion(r.duracionMin);
    const como = r.motivo === EV.MOTIVO.MANUAL ? 'despejado por el operador' : r.motivo === EV.MOTIVO.FIN_PROGRAMADO ? 'terminó (fin programado)' : 'despejado';
    alertas.push(crearAlerta({
      nivel: 'info', categoria: 'evento_vial', entidad: `${r.codigoEvento}|despejado`,
      titulo: `✅ ${EV.nombreTipo(e.tipoEvento)} ${como}`,
      mensaje: [lugar(e), duracion ? `duró ${duracion}` : null].filter(Boolean).join(' · ') || 'Evento vial despejado',
      coordenadas: punto(e),
    }, ahora));
  });
  return alertas;
}

// ── Alertas tempranas del analista IA (fase 3) ───────────────────────────────

/**
 * Hallazgos PUBLICADO del analista IA → alertas del mapa. El sello «IA», la confianza y el horizonte van en el texto
 * (las alertas del mapa tienen un formato único). La entidad agrupa por tipo y entidad: una alerta que el analista
 * actualiza en cada ciclo no vuelve a sonar hasta que pase el enfriamiento.
 * @param {Array<{id, tipo, entidad, severidad, confianza, horizonteMinH, horizonteMaxH, titulo, explicacion, soloSimulado?}>} hallazgos
 */
function alertasIA(hallazgos = [], ahora = new Date()) {
  const nivel = { critica: 'error', atencion: 'warning', info: 'info' };
  const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
  return hallazgos.map((h) => {
    const horizonte = n(h.horizonteMinH) !== null && n(h.horizonteMaxH) !== null ? `en ${n(h.horizonteMinH)}–${n(h.horizonteMaxH)} h` : null;
    const confianza = n(h.confianza) !== null ? `confianza ${Math.round(n(h.confianza) * 100)} %` : null;
    return crearAlerta({
      nivel: nivel[h.severidad] || 'info', categoria: 'ia_temprana', entidad: `${h.tipo}|${h.entidad || ''}`,
      titulo: `🧠 IA · ${String(h.titulo || '').slice(0, 120)}`,
      mensaje: [String(h.explicacion || '').slice(0, 220), [horizonte, confianza].filter(Boolean).join(' · ')].filter(Boolean).join(' — '),
      coordenadas: null, simulado: !!h.soloSimulado,
    }, ahora);
  });
}

// ── Ocupación de muelles ─────────────────────────────────────────────────────

/**
 * Ocupación por terminal con histéresis: alerta al subir de nivel (amarillo / rojo) y se rearma cuando baja
 * del umbral de rearme; entre el rearme y el amarillo se conserva el estado.
 * @param {Map<string,'normal'|'atencion'|'critico'>} estados  estado previo por terminal (se actualiza)
 * @param {{atencion?:number, critico?:number, rearme?:number}} [opc]
 */
function alertasOcupacion(puerto, ocupacion, estados, coordenadas = null, ahora = new Date(), opc = {}) {
  const atencion = opc.atencion ?? defecto('ocupacion', 0);
  const critico = opc.critico ?? defecto('ocupacion', 1);
  const rearme = opc.rearme ?? defecto('ocupacion', 2);
  const alertas = [];
  (ocupacion?.terminales || []).forEach((t) => {
    const operables = (t.muelles || []).filter((m) => !m.enMantenimiento);
    if (!operables.length) return;
    const ocupados = operables.filter((m) => m.ocupado).length;
    const pct = Math.round((ocupados / operables.length) * 100);
    const clave = `${puerto}|${t.idTerminal}`;
    const antes = estados.get(clave) || 'normal';
    let ahoraEstado;
    if (pct >= critico) ahoraEstado = 'critico';
    else if (pct >= atencion) ahoraEstado = antes === 'critico' ? 'critico' : 'atencion';
    else if (pct < rearme) ahoraEstado = 'normal';
    else ahoraEstado = antes;
    estados.set(clave, ahoraEstado);

    const subio = (antes === 'normal' && ahoraEstado !== 'normal') || (antes === 'atencion' && ahoraEstado === 'critico');
    if (!subio) return;
    const esCritico = ahoraEstado === 'critico';
    alertas.push(crearAlerta({
      nivel: esCritico ? 'error' : 'warning', categoria: 'ocupacion', entidad: clave,
      titulo: esCritico ? `🔴 ${t.nombre}: muelles saturados` : `🟡 ${t.nombre}: ocupación alta`,
      mensaje: `${ocupados} de ${operables.length} muelles ocupados (${pct} %)`,
      coordenadas,
    }, ahora));
  });
  return alertas;
}

// ── Reglas marítimas (AIS) ───────────────────────────────────────────────────

/**
 * Naves que entran a la zona de un faro con alerta activada (solo transición).
 * @param {Array<{mmsi:string, nombre?:string, lon:number, lat:number}>} naves  posiciones nuevas
 * @param {Array<{id:string|number, nombre:string, geometria:object}>} faros  geometría GeoJSON (Polygon/MultiPolygon)
 * @param {Map<string,string|null>} zonaPrevia  mmsi → id del faro donde estaba (se actualiza)
 */
function alertasNavesFaros(naves, faros, zonaPrevia, ahora = new Date()) {
  const alertas = [];
  naves.forEach((n) => {
    const p = [n.lon, n.lat];
    if (!esPunto(p)) return;
    const faro = faros.find((f) => { try { return dentroDe(p, f.geometria); } catch { return false; } }) || null;
    const id = faro ? String(faro.id) : null;
    const antes = zonaPrevia.has(n.mmsi) ? zonaPrevia.get(n.mmsi) : undefined;
    zonaPrevia.set(n.mmsi, id);
    if (!faro || antes === id || antes === undefined) return; // primera vez que se ve la nave: solo se aprende
    alertas.push(crearAlerta({
      nivel: 'info', categoria: 'faro', entidad: `${n.mmsi}|${id}`,
      titulo: `⚓ ${n.nombre || n.mmsi}`,
      mensaje: `Ingresó a zona: ${faro.nombre}`,
      coordenadas: p,
    }, ahora));
  });
  return alertas;
}

const lugarMuelle = (e) => [e.codigo_muelle && `Muelle ${e.codigo_muelle}`, e.id_terminal].filter(Boolean).join(' · ');
const horasMin = (min) => (min >= 90 ? `${(min / 60).toFixed(1)} h` : `${Math.round(min)} min`);

/**
 * Atraques y zarpes a partir de los cambios de estado confirmados por el motor AIS.
 * @param {Array<{mmsi, nombre_motonave, estado_anterior, estado_nuevo, id_terminal, codigo_muelle, lat, lon, duracion_anterior_min}>} eventos
 */
function alertasCambiosEstado(eventos, ahora = new Date()) {
  const alertas = [];
  eventos.forEach((e) => {
    const nombre = e.nombre_motonave || e.mmsi;
    const coords = [Number(e.lon), Number(e.lat)];
    if (e.estado_nuevo === 'ATRACADO' && e.estado_anterior !== 'ATRACADO') {
      const espera = e.estado_anterior === 'FONDEADO' && e.duracion_anterior_min ? ` · esperó ${horasMin(e.duracion_anterior_min)} en fondeo` : '';
      alertas.push(crearAlerta({
        nivel: 'info', categoria: 'atraque', entidad: String(e.mmsi),
        titulo: `⚓ ${nombre} atracó`, mensaje: `${lugarMuelle(e) || 'En muelle'}${espera}`, coordenadas: coords,
      }, ahora));
    } else if (e.estado_anterior === 'ATRACADO' && e.estado_nuevo !== 'ATRACADO') {
      const estadia = e.duracion_anterior_min ? ` · estuvo ${horasMin(e.duracion_anterior_min)} atracada` : '';
      alertas.push(crearAlerta({
        nivel: 'info', categoria: 'zarpe', entidad: String(e.mmsi),
        titulo: `🚢 ${nombre} desatracó`, mensaje: `${lugarMuelle(e) || 'Muelle'}${estadia}`, coordenadas: coords,
      }, ahora));
    }
  });
  return alertas;
}

/**
 * Naves fondeadas por encima del umbral (amarillo) o del umbral rojo.
 * @param {Array<{mmsi, nombre, latitud, longitud, minutos}>} cola  cola de fondeo del puerto
 * @param {{atencionHoras?:number, criticoHoras?:number}} [opc]
 */
function alertasFondeo(puerto, cola, ahora = new Date(), opc = {}) {
  const atencion = (opc.atencionHoras ?? defecto('fondeo', 0)) * 60;
  const critico = (opc.criticoHoras ?? defecto('fondeo', 1)) * 60;
  return (cola || []).filter((n) => Number(n.minutos) >= atencion).map((n) => {
    const rojo = Number(n.minutos) >= critico;
    return crearAlerta({
      nivel: rojo ? 'error' : 'warning', categoria: 'fondeo', entidad: `${puerto}|${n.mmsi}|${rojo ? 'rojo' : 'amarillo'}`,
      titulo: `${rojo ? '🔴' : '🟡'} ${n.nombre || n.mmsi} lleva ${horasMin(Number(n.minutos))} fondeada`,
      mensaje: rojo ? 'Supera el tiempo crítico de espera en fondeo' : 'Espera en fondeo por encima de lo normal',
      coordenadas: [Number(n.longitud), Number(n.latitud)],
    }, ahora);
  });
}

// ── Puntos de control (CC-238) ───────────────────────────────────────────────

const GRAVEDAD_PC = { SIN_DATO: 0, NORMAL: 1, ATENCION: 2, CRITICO: 3 };
const numeroTexto = (v) => (Number.isFinite(Number(v)) ? String(Math.round(Number(v) * 100) / 100).replace('.', ',') : '—');

/**
 * Avisa cuando una métrica con «avisar» SUBE a atención o a crítico respecto del último estado conocido (la última lectura con dato:
 * SIN_DATO no cuenta, ni para avisar ni para rearmar). Bajar o quedarse igual no avisa; volver a normal rearma.
 * @param {Array<{id_infraestructura, id_metrica, estado, valor, unidad, umbral_amarillo, umbral_rojo, sentido, alerta,
 *                 nombre_infraestructura, nombre_metrica, id_puerto, coordenadas, simulado}>} lecturas
 * @param {Map<string,string>} previos  `${id_infraestructura}|${id_metrica}` → último estado con dato
 */
function alertasPuntosControl(lecturas = [], previos = new Map(), ahora = new Date()) {
  const alertas = [];
  lecturas.forEach((l) => {
    if (!(l.alerta === true || l.alerta === 1) || !['ATENCION', 'CRITICO'].includes(l.estado)) return;
    const antes = previos.get(`${l.id_infraestructura}|${l.id_metrica}`) || 'NORMAL';
    if ((GRAVEDAD_PC[l.estado] || 0) <= (GRAVEDAD_PC[antes] || 0)) return;
    const rojo = l.estado === 'CRITICO';
    const umbral = rojo ? l.umbral_rojo : l.umbral_amarillo;
    const unidad = l.unidad ? ` ${l.unidad}` : '';
    const relacion = l.sentido === 'MENOR_PEOR' ? 'hasta' : 'desde';
    const valor = `${numeroTexto(l.valor)}${unidad}`;
    alertas.push(crearAlerta({
      nivel: rojo ? 'error' : 'warning', categoria: 'punto_control', entidad: `${l.id_infraestructura}|${l.id_metrica}|${l.estado}`,
      titulo: `${rojo ? '🔴' : '🟡'} ${l.nombre_infraestructura || 'Punto de control'}: ${l.nombre_metrica || 'métrica'} ${rojo ? 'en crítico' : 'en atención'}`,
      mensaje: umbral === null || umbral === undefined ? valor : `${valor} · ${rojo ? 'rojo' : 'amarillo'} ${relacion} ${numeroTexto(umbral)}${unidad}`,
      coordenadas: l.coordenadas || null, simulado: !!l.simulado,
      ...(l.id_puerto ? { puertos: [l.id_puerto] } : {}),
    }, ahora));
  });
  return alertas;
}

// ── Antirruido ───────────────────────────────────────────────────────────────

/** Deja pasar una alerta por (categoría, entidad) cada `tiempos[categoría]` ms. */
class Enfriamiento {
  constructor(tiempos = Object.fromEntries(Object.entries(CATALOGO_REGLAS).map(([k, r]) => [k, r.enfriamientoMin * 60000]))) {
    this.tiempos = { ...tiempos };
    this.ultimo = new Map();
  }
  fijarTiempos(tiempos) { this.tiempos = { ...this.tiempos, ...tiempos }; }
  permitir(alerta, ahora = Date.now()) {
    const clave = `${alerta.categoria}|${alerta.entidad}`;
    const espera = this.tiempos[alerta.categoria] ?? 10 * 60 * 1000;
    const previo = this.ultimo.get(clave);
    if (previo !== undefined && ahora - previo < espera) return false;
    this.ultimo.set(clave, ahora);
    return true;
  }
  /** Libera memoria de claves vencidas. */
  purgar(ahora = Date.now()) {
    const maximo = Math.max(...Object.values(this.tiempos));
    this.ultimo.forEach((t, k) => { if (ahora - t > maximo) this.ultimo.delete(k); });
  }
}

/** Peajes del GeoJSON de INVIAS → [{ nombre, coordenadas }]. */
function peajesDesdeGeoJson(fc) {
  return (fc?.features || []).map((f) => ({
    nombre: f.properties?.nombre_peaje || f.properties?.nombre || 'Peaje',
    coordenadas: f.geometry?.coordinates,
  })).filter((p) => esPunto(p.coordenadas));
}

module.exports = {
  CATALOGO_REGLAS, resolverConfig, crearAlerta,
  alertasPeajes, alertasGeocercas, alertasProximidadEventos, alertasOcupacion,
  alertasNavesFaros, alertasCambiosEstado, alertasFondeo, alertasEventosViales, alertasIA, alertasPuntosControl,
  Enfriamiento, peajesDesdeGeoJson, distanciaATramo, metros,
};
