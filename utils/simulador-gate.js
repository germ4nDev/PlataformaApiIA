/*
    Author: German Valencia
    Pattern: PORTTOS Núcleo puro (AD-16) - Simulador de citas del Virtual Gate (OT-009, 2026-10-29)
    Description: Sin base de datos ni red; lo usan simulador-operacion.service.js y las pruebas.
      Mientras un puerto no tenga citas reales, genera las citas de la ventana del tablero (24 h atrás y 24 h adelante):
        - reproducibles: la semilla es puerto + hora de la cita, así el mismo puerto y la misma hora dan siempre las mismas
          citas (placa, terminal, carga), y lo único que cambia con el reloj es el estado de cada una;
        - escaladas por el puerto: las citas por hora salen de los muelles de sus terminales (nada fijo a un puerto) y
          siguen el ciclo del día (más de día, menos de noche, hora de Colombia);
        - el estado sale de la hora de la cita frente a la hora actual: programada → en ruta → enturnada → en cola o
          pre-gate → validada / en operación → finalizada; unas pocas quedan retenidas por una validación fallida;
        - el pesaje de báscula solo existe después del gate (antes es null, sin inventarlo).
      Todo va con fuente SIMULADOR y simulado = 1 (lo pone el servicio).
*/
const { franjaHoraria } = require('./virtual-gate');

const HORA = 3600000;
const VENTANA = Object.freeze({ atrasHoras: 24, adelanteHoras: 24 });
const PARAMETROS = Object.freeze({
  citasHora: [2, 14],          // mínimo y máximo de citas por hora (antes del ciclo del día)
  citasPorMuelle: 0.55,
  factorDia: 1.3,              // 06:00 a 18:59 hora de Colombia
  factorNoche: 0.45,
  probRetenida: 0.04,
});
const CARGAS = Object.freeze([
  // tipo_carga, operaciones posibles, peso de báscula [min, max] en t (null = no se pesa)
  ['CONTENEDOR', ['RETIRO', 'DEVOLUCION', 'INGRESO'], [12, 32]],
  ['GRANEL', ['INGRESO', 'RETIRO'], [28, 36]],
  ['CARGA_SUELTA', ['RETIRO', 'INGRESO'], [8, 30]],
  ['RORO', ['TRASIEGO', 'RETIRO'], null],
]);
const NOMBRES = ['CARLOS', 'JUAN', 'LUIS', 'JORGE', 'ANDRES', 'MARIO', 'JOSE', 'DIEGO', 'FREDDY', 'WILSON', 'HERNAN', 'OSCAR'];
const APELLIDOS = ['PEREZ', 'GOMEZ', 'DIAZ', 'RODRIGUEZ', 'MARTINEZ', 'LOPEZ', 'GARCIA', 'MOSQUERA', 'RIASCOS', 'VALENCIA', 'OCORO', 'TORRES'];
const TRANSPORTADORES = ['TRANSCARGA', 'COLTRANES', 'LOGISTICA DEL MAR', 'TRANSPORTES MONTEJO', 'COORDINADORA', 'TRANSPORTES SAFERBO', 'OPEN MARKET', 'TCC CARGA'];
const LETRAS = 'BCDFGHJKLMNPRSTVWXYZ';

/** Hash de 32 bits (FNV-1a) de un texto. */
function hash32(t) {
  let h = 2166136261;
  for (const ch of String(t)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** Generador determinista (mulberry32) a partir de un texto. */
function rngDe(semilla) {
  let a = hash32(semilla);
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const entre = (rng, a, b) => a + (b - a) * rng();
const entero = (rng, a, b) => Math.floor(entre(rng, a, b + 1));
const elegir = (rng, lista) => lista[Math.floor(rng() * lista.length) % lista.length];
const horaColombia = (ms) => new Date(ms - 5 * HORA).getUTCHours();
const inicioHora = (ms) => ms - (((ms % HORA) + HORA) % HORA);

/**
 * Perfil del puerto para el simulador.
 * @param {string} clave  puerto (semilla)
 * @param {{ id_terminal: string, nombre?: string, muelles?: number }[]} terminales
 */
function perfilPuerto(clave, terminales = []) {
  const lista = terminales.length ? terminales : [{ id_terminal: 'TERMINAL', muelles: 1 }];
  const muelles = lista.reduce((t, x) => t + Math.max(1, Number(x.muelles) || 0), 0);
  const [min, max] = PARAMETROS.citasHora;
  const citasHora = Math.max(min, Math.min(max, Math.round(1.5 + muelles * PARAMETROS.citasPorMuelle)));
  // Mezcla de carga propia del puerto (estable): cada puerto pesa distinto cada tipo
  const r = rngDe(`${clave}|mezcla`);
  const mezcla = CARGAS.map(() => 0.4 + r());
  return {
    clave,
    citasHora,
    terminales: lista.map((x) => ({ id: String(x.id_terminal).toUpperCase(), peso: Math.max(1, Number(x.muelles) || 0) })),
    mezcla,
  };
}

function elegirPonderado(rng, items, pesos) {
  const total = pesos.reduce((a, b) => a + b, 0);
  let x = rng() * total;
  for (let i = 0; i < items.length; i++) { x -= pesos[i]; if (x <= 0) return items[i]; }
  return items[items.length - 1];
}

function placa(rng) {
  const l = () => LETRAS[Math.floor(rng() * LETRAS.length)];
  return `${l()}${l()}${l()}-${String(entero(rng, 100, 999))}`;
}

/** Citas (sin estado) de una hora: siempre las mismas para el mismo puerto y la misma hora. */
function citasDeLaHora(perfil, horaMs) {
  const hora = inicioHora(horaMs);
  const rng = rngDe(`${perfil.clave}|${new Date(hora).toISOString()}`);
  const h = horaColombia(hora);
  const factor = h >= 6 && h <= 18 ? PARAMETROS.factorDia : PARAMETROS.factorNoche;
  const n = Math.max(0, Math.round(perfil.citasHora * factor * entre(rng, 0.75, 1.25)));
  const sello = new Date(hora).toISOString().slice(0, 13).replace(/\D/g, '');
  const citas = [];
  for (let i = 0; i < n; i++) {
    const [tipo, operaciones, rangoPeso] = elegirPonderado(rng, CARGAS, perfil.mezcla);
    citas.push({
      id_cita: `SIM-VG-${perfil.clave.slice(0, 4)}-${sello}-${String(i + 1).padStart(2, '0')}`,
      placa: placa(rng),
      conductor: `${elegir(rng, NOMBRES)} ${elegir(rng, APELLIDOS)}`,
      transportador: elegir(rng, TRANSPORTADORES),
      tipo_carga: tipo,
      operacion: elegir(rng, operaciones),
      terminal: elegirPonderado(rng, perfil.terminales.map((t) => t.id), perfil.terminales.map((t) => t.peso)),
      fecha_hora_cita: new Date(hora + Math.floor(rng() * 60) * 60000).toISOString(),
      // Rasgos fijos de la cita que luego usa el estado
      _peso: rangoPeso ? Math.round(entre(rng, ...rangoPeso) * 10) / 10 : null,
      _retenida: rng() < PARAMETROS.probRetenida,
      _ritmo: rng(),          // 0 = fluida, 1 = lenta (espera y distancia)
    });
  }
  return citas;
}

/** Estado, ubicación, distancia, espera y validaciones de una cita a la hora 'ahoraMs'. */
function estadoCita(cita, ahoraMs) {
  const t = (Date.parse(cita.fecha_hora_cita) - ahoraMs) / 60000;   // minutos hasta la cita (negativo = ya pasó)
  const k = cita._ritmo;
  const v = (valor) => ({ validacion_ocr: valor, validacion_biometria: valor, validacion_documental: valor });
  let e;
  if (t > 120) e = { estado: 'PROGRAMADO', ubicacion: 'Origen del viaje', distancia_km: null, tiempo_espera_minutos: 0, ...v(null) };
  else if (t > 30) e = { estado: 'EN_RUTA', ubicacion: t > 75 ? 'Anillo periférico' : 'Corredor logístico', distancia_km: Math.round((3 + (t - 30) / 90 * 7) * 10) / 10, tiempo_espera_minutos: 0, ...v(null) };
  else if (t > 0) e = { estado: 'ENTURNADO', ubicacion: 'Zona de enturnamiento', distancia_km: Math.round((1 + t / 30 * 2) * 10) / 10, tiempo_espera_minutos: Math.round(k * 15), ...v(null) };
  else if (t > -60) {
    // Ya es la hora: espera en cola o en pre-gate; las lentas pasan los umbrales de 25 y 45 min
    const espera = Math.round(Math.min(-t, 60) * (0.3 + k * 0.9));
    const enPreGate = k < 0.5 || -t > 30;
    e = { estado: enPreGate ? 'PRE_GATE' : 'EN_COLA', ubicacion: enPreGate ? 'Pre-gate' : 'Zona de enturnamiento', distancia_km: enPreGate ? 0.5 : 1.6, tiempo_espera_minutos: espera, ...v(enPreGate ? true : null) };
  } else if (t > -180) e = { estado: t > -120 ? 'VALIDADO' : 'EN_OPERACION', ubicacion: 'En terminal', distancia_km: 0, tiempo_espera_minutos: Math.round(10 + k * 25), ...v(true) };
  else e = { estado: 'FINALIZADO', ubicacion: 'Salida del puerto', distancia_km: 0, tiempo_espera_minutos: Math.round(10 + k * 25), ...v(true) };

  if (cita._retenida && t <= 30 && t > -180) {
    e = { ...e, estado: 'RETENIDO', ubicacion: 'Pre-gate', distancia_km: 0.5, validacion_documental: false, validacion_ocr: true, validacion_biometria: true };
  }
  const pesado = ['VALIDADO', 'EN_OPERACION', 'FINALIZADO'].includes(e.estado);
  return { ...e, peso_bascula_ton: pesado ? cita._peso : null };
}

/**
 * Filas de TCL_CitasVirtualGate para la ventana del tablero alrededor de 'ahoraMs'.
 * @returns {object[]} filas listas para guardar (sin id_puerto, fuente ni simulado: los pone el servicio)
 */
function citasVentana(perfil, ahoraMs, ventana = VENTANA) {
  const desde = inicioHora(ahoraMs - ventana.atrasHoras * HORA);
  const hasta = ahoraMs + ventana.adelanteHoras * HORA;
  const filas = [];
  for (let h = desde; h <= hasta; h += HORA) {
    for (const c of citasDeLaHora(perfil, h)) {
      const ms = Date.parse(c.fecha_hora_cita);
      if (ms < ahoraMs - ventana.atrasHoras * HORA || ms > hasta) continue;
      const { _peso, _retenida, _ritmo, ...base } = c;
      filas.push({ ...base, franja_horaria: franjaHoraria(c.fecha_hora_cita), ...estadoCita(c, ahoraMs) });
    }
  }
  return filas;
}

module.exports = { PARAMETROS, VENTANA, hash32, rngDe, perfilPuerto, citasDeLaHora, estadoCita, citasVentana };
