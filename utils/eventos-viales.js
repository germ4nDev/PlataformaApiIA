/*
    Author: German Valencia
    Pattern: PORTTOS Core puro (AD-16) - Ciclo de vida de los eventos viales
    Description: Sin base de datos ni red. Decide qué pasa con cada evento vial después de una sincronización
      con TomTom (cada 10 min):
        - mapearIncidente(): incidente de TomTom → evento de Porttos (tipo, severidad, sector, fechas, zona).
        - reconciliar(): cruza lo que TomTom reportó con lo que está ACTIVO en la base y devuelve
          nuevos · vistos · ausentes · resueltos.
      Reglas de cierre:
        1. TomTom lo sigue reportando → sigue ACTIVO (se renueva su último reporte; el inicio no cambia).
        2. Deja de reportarlo y SU ZONA respondió bien → suma una ausencia; al llegar al umbral de su tipo
           (accidentes, varados, congestión y clima: 2 ciclos ≈ 20 min; cierres y obras: 6 ciclos ≈ 1 h,
           porque TomTom a veces omite un cierre largo en una consulta) → RESUELTO, motivo NO_REPORTADO.
        3. Su zona falló (403, sin red, timeout) → no se toca: una falla de la fuente no borra un accidente.
        4. Tiene fecha de fin y ya pasó → RESUELTO, motivo FIN_PROGRAMADO (también los manuales).
        5. Los manuales (operador o ingesta; fuente distinta de TOMTOM o vacía) nunca se cierran por ausencia:
           los cierra el operador.
      Estados: ACTIVO → DESPEJADO (el dominio que ya tenía EventoVialSchema), con motivoCierre y fechaFin.
      Vigencia en el mapa: ACTIVO y, si es de TomTom, reportado en las últimas 24 h (respaldo por si la
      sincronización se detiene días).
*/

const MINUTO = 60000;
const VIGENCIA_MAX_MS = 24 * 60 * MINUTO;
const FUENTE_TOMTOM = 'TOMTOM';

/** Ciclos seguidos sin reporte para dar por resuelto un evento, por tipo. */
const AUSENCIAS_PARA_CERRAR = Object.freeze({
  ACCIDENTE: 2,
  VEHICULO_AVERIADO: 2,
  CONGESTION: 2,
  ALERTA_CLIMATICA: 2,
  ALERTA_VIAL: 2,
  CIERRE_VIAL: 6,
  MANTENIMIENTO_OBRA: 6,
});

const NOMBRE_TIPO = Object.freeze({
  ACCIDENTE: 'Accidente',
  VEHICULO_AVERIADO: 'Vehículo varado',
  CONGESTION: 'Congestión',
  ALERTA_CLIMATICA: 'Clima en la vía',
  ALERTA_VIAL: 'Novedad vial',
  CIERRE_VIAL: 'Cierre vial',
  MANTENIMIENTO_OBRA: 'Obra en la vía',
});

const MOTIVO = Object.freeze({
  NO_REPORTADO: 'NO_REPORTADO',
  FIN_PROGRAMADO: 'FIN_PROGRAMADO',
  MANUAL: 'MANUAL',
});

/**
 * iconCategory de TomTom (incidentDetails v5) → tipo de Porttos.
 * 0 desconocido · 1 accidente · 2 niebla · 3 condición peligrosa · 4 lluvia · 5 hielo · 6 congestión ·
 * 7 carril cerrado · 8 vía cerrada · 9 obras · 10 viento · 11 inundación · 14 vehículo varado.
 * (Antes 9 se tomaba como cierre y 11 como obra.)
 */
function tipoDesdeTomTom(categoria) {
  switch (Number(categoria) || 0) {
    case 1: return 'ACCIDENTE';
    case 6: return 'CONGESTION';
    case 7: case 8: return 'CIERRE_VIAL';
    case 9: return 'MANTENIMIENTO_OBRA';
    case 2: case 3: case 4: case 5: case 10: case 11: return 'ALERTA_CLIMATICA';
    case 14: return 'VEHICULO_AVERIADO';
    default: return 'ALERTA_VIAL';
  }
}

const umbralAusencias = (tipo) => AUSENCIAS_PARA_CERRAR[String(tipo || '').toUpperCase()] || 2;
const ms = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const t = v instanceof Date ? v.getTime() : Date.parse(v);
  return Number.isFinite(t) ? t : null;
};
const iso = (t) => (t === null ? null : new Date(t).toISOString());
const esPunto = (lon, lat) => lon !== null && lat !== null && lon !== undefined && lat !== undefined
  && Number.isFinite(Number(lon)) && Number.isFinite(Number(lat));

/** Zona (por su caja 'oeste,sur,este,norte') que contiene el punto, o null. */
function zonaDePunto(lon, lat, zonas = []) {
  if (!esPunto(lon, lat)) return null;
  const x = Number(lon);
  const y = Number(lat);
  const zona = zonas.find((z) => {
    const [oeste, sur, este, norte] = String(z.bbox || '').split(',').map(Number);
    return x >= oeste && x <= este && y >= sur && y <= norte;
  });
  return zona ? zona.nombre : null;
}

/**
 * Incidente de TomTom → datos para EventoVialDTO + campos de ciclo de vida.
 * @param {object} item     { geometry, properties }
 * @param {{nombre:string, corredor?:string}|null} zona  zona de la consulta donde vino
 * @returns {object|null}   null si no trae id o punto
 */
function mapearIncidente(item, zona = null) {
  const props = item?.properties || {};
  const coords = item?.geometry?.coordinates;
  const punto = Array.isArray(coords?.[0]) ? coords[0] : coords;
  const lon = Array.isArray(punto) ? punto[0] : null;
  const lat = Array.isArray(punto) ? punto[1] : null;
  if (!props.id || !esPunto(lon, lat)) return null;

  const magnitud = Number(props.magnitudeOfDelay) || 0;
  const severidad = magnitud >= 3 ? 3 : magnitud === 2 ? 2 : 1;
  const descripcion = (props.events || []).map((e) => e.description).filter(Boolean).join(' | ').substring(0, 4000);
  const sector = props.from ? `De ${props.from} a ${props.to || ''}`.trim() : 'Sector georreferenciado';

  return {
    idExterno: String(props.id),
    codigoEvento: String(props.id),
    corredorVial: (zona?.corredor || zona?.nombre || 'Corredor vial').substring(0, 100),
    sector: sector.substring(0, 100),
    tipoEvento: tipoDesdeTomTom(props.iconCategory),
    descripcion: descripcion || 'Novedad vial reportada.',
    nivelSeveridad: severidad,
    estadoEvento: 'ACTIVO',
    ubicacion_geo: { type: 'Point', coordinates: [lon, lat] },
    // startTime solo si TomTom lo manda; si no, al crearlo vale la hora del primer reporte
    fechaInicio: ms(props.startTime) !== null ? iso(ms(props.startTime)) : null,
    fechaFin: ms(props.endTime) !== null ? iso(ms(props.endTime)) : null,
    fuente: FUENTE_TOMTOM,
    zonaFuente: zona?.nombre || null,
  };
}

const duracionMin = (inicio, fin) => {
  const a = ms(inicio);
  const b = ms(fin);
  return a !== null && b !== null && b >= a ? Math.round((b - a) / MINUTO) : null;
};

/**
 * Cruza lo reportado por TomTom con lo ACTIVO en la base.
 * @param {object} p
 * @param {Array<object>} p.reportados  salida de mapearIncidente() (ya validada)
 * @param {Array<object>} p.activos     filas ACTIVO: codigoEvento, fuente, zonaFuente, tipoEvento, ausencias,
 *                                      fechaInicio, fechaFin, fechaUltimoReporte, lon, lat (+ lo que se quiera devolver)
 * @param {Array<{nombre:string, bbox:string, ok:boolean}>} p.zonas  zonas consultadas y si respondieron
 * @param {Date} [p.ahora]
 * @returns {{nuevos:object[], vistos:object[], ausentes:{codigoEvento:string, ausencias:number}[],
 *            resueltos:{codigoEvento:string, motivo:string, fechaFin:string, duracionMin:number|null, evento:object}[]}}
 */
function reconciliar({ reportados = [], activos = [], zonas = [], ahora = new Date() }) {
  const t = ahora.getTime();
  const zonasOk = new Set(zonas.filter((z) => z.ok).map((z) => z.nombre));
  const porCodigo = new Map(activos.map((a) => [String(a.codigoEvento), a]));
  const reportadosIds = new Set();
  const nuevos = [];
  const vistos = [];
  const ausentes = [];
  const resueltos = [];

  const resolver = (evento, motivo, finMs) => {
    const fechaFin = iso(finMs);
    resueltos.push({ codigoEvento: String(evento.codigoEvento), motivo, fechaFin, duracionMin: duracionMin(evento.fechaInicio, fechaFin), evento });
  };

  reportados.forEach((r) => {
    const codigo = String(r.codigoEvento);
    if (reportadosIds.has(codigo)) return;            // TomTom repite un incidente en dos zonas vecinas
    reportadosIds.add(codigo);
    const previo = porCodigo.get(codigo);
    const finMs = ms(r.fechaFin);
    if (finMs !== null && finMs <= t) {               // ya terminó según la fuente
      if (previo) resolver({ ...previo, ...r, fechaInicio: previo.fechaInicio }, MOTIVO.FIN_PROGRAMADO, finMs);
      return;
    }
    const base = { ...r, ausencias: 0, fechaUltimoReporte: iso(t), motivoCierre: null };
    if (previo) vistos.push({ ...base, fechaInicio: r.fechaInicio || iso(ms(previo.fechaInicio)) || iso(t) });
    else nuevos.push({ ...base, fechaInicio: r.fechaInicio || iso(t) });
  });

  activos.forEach((a) => {
    const codigo = String(a.codigoEvento);
    if (reportadosIds.has(codigo)) return;
    const finMs = ms(a.fechaFin);
    if (finMs !== null && finMs <= t) {
      resolver(a, MOTIVO.FIN_PROGRAMADO, finMs);
      return;
    }
    if (String(a.fuente || 'MANUAL').toUpperCase() !== FUENTE_TOMTOM) return;   // manual: lo cierra el operador
    const zona = a.zonaFuente || zonaDePunto(a.lon, a.lat, zonas);
    if (!zona || !zonasOk.has(zona)) return;          // su zona no respondió: no se puede saber
    const ausencias = (Number(a.ausencias) || 0) + 1;
    if (ausencias >= umbralAusencias(a.tipoEvento)) {
      resolver(a, MOTIVO.NO_REPORTADO, ms(a.fechaUltimoReporte) ?? t);
    } else {
      ausentes.push({ codigoEvento: codigo, ausencias, zonaFuente: zona });
    }
  });

  return { nuevos, vistos, ausentes, resueltos };
}

/** ¿Se muestra en el mapa? ACTIVO y, si es de TomTom, reportado en las últimas 24 h. */
function esVigente(evento, ahora = new Date()) {
  if (String(evento?.estadoEvento || '').toUpperCase() !== 'ACTIVO') return false;
  if (String(evento.fuente || 'MANUAL').toUpperCase() !== FUENTE_TOMTOM) return true;
  const ultimo = ms(evento.fechaUltimoReporte);
  return ultimo !== null && ahora.getTime() - ultimo <= VIGENCIA_MAX_MS;
}

/** Texto corto de la duración: '45 min', '1 h 20 min', '2 d 3 h'. */
function textoDuracion(minutos) {
  if (minutos === null || minutos === undefined) return null;
  if (minutos < 60) return `${minutos} min`;
  if (minutos < 1440) return `${Math.floor(minutos / 60)} h${minutos % 60 ? ` ${minutos % 60} min` : ''}`;
  const horas = Math.floor((minutos % 1440) / 60);
  return `${Math.floor(minutos / 1440)} d${horas ? ` ${horas} h` : ''}`;
}

const nombreTipo = (tipo) => NOMBRE_TIPO[String(tipo || '').toUpperCase()] || 'Evento vial';

module.exports = {
  AUSENCIAS_PARA_CERRAR, NOMBRE_TIPO, MOTIVO, FUENTE_TOMTOM, VIGENCIA_MAX_MS,
  tipoDesdeTomTom, umbralAusencias, zonaDePunto, mapearIncidente, reconciliar, esVigente,
  duracionMin, textoDuracion, nombreTipo,
};
