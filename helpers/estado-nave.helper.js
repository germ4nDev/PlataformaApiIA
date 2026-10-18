/*
    Author: German Valencia
    Pattern: PORTTOS Helper
    Descripción: Inferencia del estado operativo de una motonave a partir de AIS.

    Combina tres señales, porque ninguna sola es confiable:
      1. NavigationalStatus: lo que declara la tripulación (suele quedar desactualizado).
      2. SOG: velocidad sobre el fondo (tiene ruido de GPS cuando la nave está quieta).
      3. Zona: muelle / terminal / puerto donde está la nave (geocercas de Porttos).

    La geocerca manda sobre lo declarado: una nave quieta dentro de un muelle está ATRACADA
    aunque siga reportando "fondeado", y una nave quieta en el puerto pero fuera de las
    terminales está FONDEADA aunque reporte "en navegación".
*/
const ESTADOS_NAVE = Object.freeze({
  ATRACADO: 'ATRACADO',
  FONDEADO: 'FONDEADO',
  EN_MANIOBRA: 'EN MANIOBRA',
  NAVEGANDO: 'NAVEGANDO',
  DETENIDO: 'DETENIDO',
  VARADO: 'VARADO',
  SIN_GOBIERNO: 'SIN GOBIERNO',
  PESCA: 'PESCA',
  REMOLQUE: 'REMOLQUE',
  EMERGENCIA: 'EMERGENCIA',
  DESCONOCIDO: 'DESCONOCIDO',
});

/** Estado de navegación AIS (ITU-R M.1371), mensaje 1/2/3. */
const NAV_STATUS_AIS = Object.freeze({
  0: 'En navegación con motor',
  1: 'Fondeado',
  2: 'Sin gobierno',
  3: 'Maniobrabilidad restringida',
  4: 'Restringido por calado',
  5: 'Atracado',
  6: 'Varado',
  7: 'Pescando',
  8: 'En navegación a vela',
  9: 'Reservado (HSC)',
  10: 'Reservado (WIG)',
  11: 'Remolcando a popa',
  12: 'Empujando o remolcando al costado',
  13: 'Reservado',
  14: 'AIS-SART / emergencia',
  15: 'No definido',
});

/** Se confirman de inmediato, sin esperar la ventana de histéresis. */
const ESTADOS_CRITICOS = new Set([ESTADOS_NAVE.VARADO, ESTADOS_NAVE.SIN_GOBIERNO, ESTADOS_NAVE.EMERGENCIA]);
const ESTADOS_VALIDOS = new Set(Object.values(ESTADOS_NAVE));

const UMBRAL_DETENIDO_NUDOS = 0.5; // por debajo, la nave está quieta
const UMBRAL_DERIVA_NUDOS = 2;     // si declara fondeado/atracado, toleramos borneo y ruido GPS
const UMBRAL_MANIOBRA_NUDOS = 5;   // dentro del puerto, por debajo de esto está maniobrando

/** AIS usa 102.3 como "velocidad no disponible". */
const normalizarSog = (sog) => {
  const n = Number(sog);
  return sog !== null && sog !== undefined && Number.isFinite(n) && n >= 0 && n < 102.3 ? n : null;
};

const normalizarNavStatus = (valor) => {
  const n = Number(valor);
  return valor !== null && valor !== undefined && Number.isInteger(n) && n >= 0 && n <= 15 ? n : null;
};

/**
 * @param {{navStatus?:number, sog?:number, zona?:{id_puerto?:string,id_terminal?:string,codigo_muelle?:string}}} senales
 * @returns {string} uno de ESTADOS_NAVE
 */
function inferirEstadoNave({ navStatus, sog, zona } = {}) {
  const nav = normalizarNavStatus(navStatus);
  const v = normalizarSog(sog);
  const enTerminal = Boolean(zona?.codigo_muelle || zona?.id_terminal);
  const enPuerto = Boolean(zona?.id_puerto);

  if (nav === 14) return ESTADOS_NAVE.EMERGENCIA;
  if (nav === 6) return ESTADOS_NAVE.VARADO;
  if (nav === 2) return ESTADOS_NAVE.SIN_GOBIERNO;

  if (v === null) {
    if (nav === 5) return ESTADOS_NAVE.ATRACADO;
    if (nav === 1) return ESTADOS_NAVE.FONDEADO;
    return ESTADOS_NAVE.DESCONOCIDO;
  }

  const quieta = v < UMBRAL_DETENIDO_NUDOS || (v < UMBRAL_DERIVA_NUDOS && (nav === 1 || nav === 5));
  if (quieta) {
    if (enTerminal || nav === 5) return ESTADOS_NAVE.ATRACADO;
    if (nav === 1 || enPuerto) return ESTADOS_NAVE.FONDEADO;
    return ESTADOS_NAVE.DETENIDO;
  }

  if (nav === 7) return ESTADOS_NAVE.PESCA;
  if (nav === 11 || nav === 12) return ESTADOS_NAVE.REMOLQUE;
  if (enPuerto && (v < UMBRAL_MANIOBRA_NUDOS || nav === 3)) return ESTADOS_NAVE.EN_MANIOBRA;
  return ESTADOS_NAVE.NAVEGANDO;
}

const textoNavStatus = (valor) => {
  const n = normalizarNavStatus(valor);
  return n === null ? null : NAV_STATUS_AIS[n];
};

module.exports = {
  ESTADOS_NAVE,
  ESTADOS_CRITICOS,
  ESTADOS_VALIDOS,
  NAV_STATUS_AIS,
  inferirEstadoNave,
  normalizarNavStatus,
  normalizarSog,
  textoNavStatus,
};
