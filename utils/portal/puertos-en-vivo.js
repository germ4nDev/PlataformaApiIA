/*
    Author: German Valencia
    Pattern: PORTTOS Util (núcleo puro, AD-16) - Puertos en vivo del portal público (OT-011, 2026-10-30)
    Description: Arma lo que la página «Puertos en vivo» de porttos.co muestra de un puerto, sin acceso a datos ni red.
      Solo fuentes públicas u oficiales y NUNCA filas simuladas (simulado = 1): el portal es público y no rotula como la
      plataforma. Si no hay dato real, la tarjeta dice «sin dato» con su fuente (datos honestos).
        listaPuertos(filas)                      activos del maestro → [{ id, nombre }] por nombre
        buscarPuerto(lista, texto)               por id o nombre normalizados ('<puerto> en minúsculas' → <PUERTO>)
        cajaAccesos(puerto)                      ±RADIO_GRADOS alrededor del puerto (la zona de acceso de utils/zonas-viales)
        zonasDelPuerto(puerto, zonasBase)        zonas de TomTom que cubren el puerto (las fijas o la de acceso que arma el cron)
        vias(eventos, lecturas, ahora)           eventos viales vigentes de TomTom en la caja: estado del peor y corredores
        trafico(filas, lecturaIso)               toneladas mensuales de Supertransporte: último mes completo, variación anual
                                                 y los últimos 12 meses (el mes que aún se carga sale parcial: esParcial)
        clima(c, ahora) · marea(m, ahora)        lectura actual de Open-Meteo y la próxima pleamar que aún no pasa (WorldTides)
        armarPuertoEnVivo({...})                 todo junto, con la hora de cada lectura
*/
const { RADIO_GRADOS, zonasDePuertos } = require('../zonas-viales');
const { FUENTE_TOMTOM, VIGENCIA_MAX_MS, zonaDePunto } = require('../eventos-viales');
const { estadoCorredor, textoClima } = require('../noticias');

const FUENTES = Object.freeze({
  VIAS: 'TomTom, eventos viales',
  TRAFICO: 'Supertransporte, datos abiertos',
  CLIMA: 'Open-Meteo',
  MAREA: 'WorldTides',
});
const FUENTE_SUPERTRANSPORTE = 'SUPERTRANSPORTE';
/** Estado de las vías cuando TomTom leyó hace poco, pero no hay constancia de la zona del puerto y no hay eventos cerca. */
const SIN_EVENTOS = 'SIN EVENTOS REPORTADOS';

const esSimulado = (f) => f && (f.simulado === true || Number(f.simulado) === 1);
const numero = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const iso = (v) => {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
};
const normalizar = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');

function listaPuertos(filas = []) {
  return filas
    .filter((f) => f && f.id_puerto)
    .map((f) => ({ id: String(f.id_puerto), nombre: f.nombre || String(f.id_puerto).replace(/_/g, ' '), lat: numero(f.lat), lon: numero(f.lon) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

function buscarPuerto(lista = [], texto = '') {
  const clave = normalizar(texto);
  if (!clave) return null;
  return lista.find((p) => normalizar(p.id) === clave || normalizar(p.nombre) === clave) || null;
}

function cajaAccesos(puerto) {
  if (!puerto || puerto.lat === null || puerto.lon === null) return null;
  return { sur: puerto.lat - RADIO_GRADOS, norte: puerto.lat + RADIO_GRADOS, oeste: puerto.lon - RADIO_GRADOS, este: puerto.lon + RADIO_GRADOS };
}

/** Nombres de las zonas de TomTom que cubren el puerto: la fija que contiene su punto o, si ninguna, la de acceso del cron. */
function zonasDelPuerto(puerto, zonasBase = []) {
  if (!puerto || puerto.lat === null || puerto.lon === null) return [];
  const fija = zonaDePunto(puerto.lon, puerto.lat, zonasBase);
  if (fija) return [fija];
  return zonasDePuertos([{ nombre: puerto.nombre, lat: puerto.lat, lon: puerto.lon }], zonasBase).map((z) => z.nombre);
}

/**
 * Vías de acceso. Solo eventos de TomTom (otras fuentes pueden ser manuales o simuladas).
 *   eventos null (la consulta falló) o TomTom sin leer en 24 h → sin dato.
 *   Hay eventos cerca → el estado del peor.
 *   Sin eventos y la zona del puerto leída hace poco → HABILITADO.
 *   Sin eventos y solo hay constancia de otras zonas → «sin eventos reportados» (no se afirma que la vía esté habilitada).
 * @param {{ zona?: string|null, global?: string|null }} lecturas  último reporte de TomTom en la zona del puerto y en cualquiera
 */
function vias(eventos, lecturas = {}, ahora = new Date()) {
  const reciente = (v) => { const l = iso(v); return l && ahora.getTime() - Date.parse(l) <= VIGENCIA_MAX_MS ? l : null; };
  const zona = reciente(lecturas.zona);
  const global = reciente(lecturas.global);
  const lectura = zona || global;
  const base = { fuente: FUENTES.VIAS, lectura };
  if (!Array.isArray(eventos) || !lectura) return { ...base, sinDato: true, estado: null, semaforo: null, eventos: 0, corredores: [] };
  const reales = eventos.filter((e) => e && e.fuente === FUENTE_TOMTOM && !esSimulado(e));
  if (!reales.length && !zona) return { ...base, sinDato: false, estado: SIN_EVENTOS, semaforo: null, eventos: 0, corredores: [] };
  const porCorredor = new Map();
  for (const e of reales) {
    const k = e.corredorVial || e.sector || 'Accesos al puerto';
    if (!porCorredor.has(k)) porCorredor.set(k, []);
    porCorredor.get(k).push(e);
  }
  const corredores = [...porCorredor.entries()]
    .map(([corredor, evs]) => ({ corredor, ...estadoCorredor(evs), eventos: evs.length }))
    .sort((a, b) => b.eventos - a.eventos || a.corredor.localeCompare(b.corredor, 'es'))
    .slice(0, 5);
  return { ...base, sinDato: false, ...estadoCorredor(reales), eventos: reales.length, corredores };
}

/**
 * Tráfico portuario. Filas { anio, mes, toneladas, fuente, simulado } (una o varias por mes: se suman).
 * Serie: los 12 meses que terminan en el último dato (los meses sin reporte salen null, no cero).
 */
function trafico(filas = [], lecturaIso = null) {
  const porMes = new Map();
  for (const f of filas) {
    if (!f || esSimulado(f) || (f.fuente && f.fuente !== FUENTE_SUPERTRANSPORTE)) continue;
    const anio = numero(f.anio);
    const mes = numero(f.mes);
    const t = numero(f.toneladas);
    if (anio === null || mes === null || mes < 1 || mes > 12 || t === null) continue;
    const k = anio * 100 + mes;
    porMes.set(k, (porMes.get(k) || 0) + t);
  }
  const base = { fuente: FUENTES.TRAFICO, lectura: iso(lecturaIso), unidad: 't' };
  if (!porMes.size) return { ...base, sinDato: true, ultimoMes: null, variacion: null, serie: [], mesParcial: null };
  const claves = [...porMes.keys()].sort((a, b) => a - b);
  const ultimo = claves[claves.length - 1];
  const parcial = esParcial(porMes, claves, ultimo);
  // La cifra principal es el último mes completo: uno que Supertransporte aún carga daría una caída que no existe
  const referencia = parcial && claves.length > 1 ? claves[claves.length - 2] : ultimo;
  const mesRef = referencia % 100;
  const anioRef = Math.floor(referencia / 100);
  const anterior = porMes.get((anioRef - 1) * 100 + mesRef);
  const variacion = anterior ? Math.round(((porMes.get(referencia) - anterior) / anterior) * 1000) / 10 : null;
  const serie = Array.from({ length: 12 }, (_, i) => {
    const total = Math.floor(ultimo / 100) * 12 + (ultimo % 100 - 1) - (11 - i);
    const anio = Math.floor(total / 12);
    const mes = (total % 12) + 1;
    const k = anio * 100 + mes;
    const v = porMes.get(k);
    return { anio, mes, toneladas: v === undefined ? null : Math.round(v), parcial: k === ultimo && parcial };
  });
  return {
    ...base, sinDato: false, ultimoMes: { anio: anioRef, mes: mesRef, toneladas: Math.round(porMes.get(referencia)) },
    variacion, serie, mesParcial: parcial ? { anio: Math.floor(ultimo / 100), mes: ultimo % 100 } : null,
  };
}

/**
 * ¿El último mes está a medio cargar? Menos de UMBRAL_PARCIAL del promedio de los 3 meses anteriores con dato.
 * Sin 3 meses de referencia no se marca (no hay contra qué comparar).
 */
const UMBRAL_PARCIAL = 0.6;
function esParcial(porMes, claves, ultimo) {
  const previos = claves.filter((k) => k < ultimo).slice(-3).map((k) => porMes.get(k));
  if (previos.length < 3) return false;
  const promedio = previos.reduce((s, v) => s + v, 0) / previos.length;
  return promedio > 0 && porMes.get(ultimo) < promedio * UMBRAL_PARCIAL;
}

function clima(c, ahora = new Date()) {
  const temperatura = numero(c?.temperatura);
  const vientoNudos = numero(c?.vientoNudos);
  const base = { fuente: FUENTES.CLIMA };
  if (temperatura === null && vientoNudos === null) return { ...base, sinDato: true, lectura: null, temperatura: null, vientoNudos: null, tiempo: null };
  const codigo = numero(c?.codigoTiempo);
  return { ...base, sinDato: false, lectura: ahora.toISOString(), temperatura, vientoNudos, tiempo: codigo === null ? null : textoClima(codigo) };
}

/**
 * Próxima pleamar: el primer extremo 'High' posterior a ahora (el adaptador guarda la respuesta 6 h, así que la primera
 * pleamar de la lista puede haber pasado). Sin una que aún no pase → sin dato. La hora va en ISO; la web la muestra en hora de Colombia.
 */
function marea(m, ahora = new Date()) {
  const base = { fuente: FUENTES.MAREA, lectura: null };
  const proxima = (m?.extremos || [])
    .filter((e) => e && e.tipo === 'High' && Date.parse(e.fechaIso) > ahora.getTime())
    .sort((a, b) => Date.parse(a.fechaIso) - Date.parse(b.fechaIso))[0];
  if (!proxima) return { ...base, sinDato: true, pleamar: null, nivel: null };
  const altura = numero(proxima.altura);
  return { ...base, sinDato: false, pleamar: iso(proxima.fechaIso), nivel: altura === null ? null : `${altura.toFixed(2)} m` };
}

function armarPuertoEnVivo({ puerto, eventos = [], lecturasVias = {}, filasTrafico = [], lecturaTrafico = null, datosClima = null, datosMarea = null }, ahora = new Date()) {
  return {
    puerto: { id: puerto.id, nombre: puerto.nombre },
    generado: ahora.toISOString(),
    vias: vias(eventos, lecturasVias, ahora),
    trafico: trafico(filasTrafico, lecturaTrafico),
    clima: clima(datosClima, ahora),
    marea: marea(datosMarea, ahora),
  };
}

module.exports = { FUENTES, SIN_EVENTOS, listaPuertos, buscarPuerto, cajaAccesos, zonasDelPuerto, vias, trafico, clima, marea, armarPuertoEnVivo };
