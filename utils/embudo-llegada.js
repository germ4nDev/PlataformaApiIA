/*
    Author: German Valencia
    Pattern: PORTTOS Núcleo puro (AD-16) - Embudo de llegada de naves
    Description: Ordena las naves de un puerto por la etapa del proceso de llegada:
        AVISADA (DIMAR, aún no en el puerto) → APROXIMACION → FONDEADA → MANIOBRA → ATRACADA
      y marca el cuello de botella: la etapa cuya espera supera la referencia histórica (p90 del fondeo
      o de la estadía). Las naves en estado crítico (varada, sin gobierno, emergencia) van aparte.
      Recibe datos ya leídos (AIS del puerto, avisos DIMAR, estadísticas de tiempos); sin red ni base.
*/

const ETAPAS = Object.freeze([
  { codigo: 'AVISADA', nombre: 'Avisadas (DIMAR)', descripcion: 'Con aviso de arribo y ETA en la ventana; aún no están en la zona del puerto' },
  { codigo: 'APROXIMACION', nombre: 'En aproximación', descripcion: 'Navegando dentro de la zona del puerto', estados: ['NAVEGANDO'] },
  { codigo: 'FONDEADA', nombre: 'Fondeadas', descripcion: 'Esperando turno en el fondeadero', estados: ['FONDEADO'] },
  { codigo: 'MANIOBRA', nombre: 'En maniobra', descripcion: 'Entrando o saliendo de muelle, con remolque o práctico', estados: ['EN MANIOBRA', 'REMOLQUE'] },
  { codigo: 'ATRACADA', nombre: 'Atracadas', descripcion: 'En muelle, operando', estados: ['ATRACADO'] },
]);
const ESTADOS_CRITICOS = ['VARADO', 'SIN GOBIERNO', 'EMERGENCIA'];
const MAXIMO_LISTA = 50;

const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const redondear = (v) => (num(v) === null ? null : Math.round(Number(v)));
const promedio = (xs) => (xs.length ? Math.round(xs.reduce((t, x) => t + x, 0) / xs.length) : null);

function naveAis(n) {
  return {
    mmsi: String(n.mmsi), nombre: n.nombre || null, estado: n.estado,
    latitud: num(n.latitud), longitud: num(n.longitud), velocidad: num(n.velocidad),
    minutos: redondear(n.minutos), idTerminal: n.idTerminal || null, codigoMuelle: n.codigoMuelle || null,
  };
}

/**
 * @param {object} p
 * @param {Array<{mmsi, nombre, estado, latitud, longitud, velocidad, minutos, idTerminal, codigoMuelle}>|null} p.navesAis
 *        null = sin datos AIS (falta la migración 005 o el motor está apagado)
 * @param {{naves: Array<{motonave, mmsi, eta, minutosParaEta, situacion, latitud, longitud, eslora}>}|null} p.llegadas
 * @param {{fondeo:{resumen:{medianaMin,p90Min}}, estadia:{resumen:{medianaMin,p90Min}}}|null} p.tiempos
 */
function armarEmbudo({ puerto = null, navesAis = null, llegadas = null, tiempos = null, horas = 72, ahora = new Date() }) {
  const ais = (navesAis || []).map(naveAis);
  const referencia = {
    FONDEADA: tiempos?.fondeo?.resumen || null,
    ATRACADA: tiempos?.estadia?.resumen || null,
  };

  const etapas = ETAPAS.map((e) => {
    let lista;
    if (e.codigo === 'AVISADA') {
      lista = (llegadas?.naves || [])
        .filter((a) => a.situacion !== 'EN PUERTO')
        .sort((a, b) => (num(a.minutosParaEta) ?? Infinity) - (num(b.minutosParaEta) ?? Infinity))
        .map((a) => ({
          mmsi: a.mmsi ? String(a.mmsi) : null, nombre: a.motonave || null, situacion: a.situacion,
          eta: a.eta || null, minutosParaEta: redondear(a.minutosParaEta),
          latitud: num(a.latitud), longitud: num(a.longitud), eslora: num(a.eslora),
        }));
    } else {
      lista = ais.filter((n) => e.estados.includes(n.estado)).sort((a, b) => (b.minutos ?? 0) - (a.minutos ?? 0));
    }

    const minutos = lista.map((n) => n.minutos).filter((m) => m !== null && m !== undefined);
    const ref = referencia[e.codigo];
    const p90 = num(ref?.p90Min);
    const sobreReferencia = p90 !== null ? lista.filter((n) => (n.minutos ?? 0) > p90).length : 0;
    const etapa = {
      codigo: e.codigo,
      nombre: e.nombre,
      descripcion: e.descripcion,
      naves: lista.length,
      minutosPromedio: e.codigo === 'AVISADA' ? null : promedio(minutos),
      minutosMaximo: minutos.length && e.codigo !== 'AVISADA' ? Math.max(...minutos) : null,
      referenciaMedianaMin: num(ref?.medianaMin),
      referenciaP90Min: p90,
      sobreReferencia,
      lista: lista.slice(0, MAXIMO_LISTA),
    };
    if (e.codigo === 'AVISADA') {
      const cuenta = (s) => lista.filter((n) => n.situacion === s).length;
      etapa.detalle = {
        enRadar: cuenta('EN RADAR'), sinAis: cuenta('SIN AIS'), atrasadas: cuenta('ATRASADA'),
        proximas24h: lista.filter((n) => n.minutosParaEta !== null && n.minutosParaEta >= 0 && n.minutosParaEta < 1440).length,
      };
    }
    return etapa;
  });

  // Cuello de botella: la etapa con espera (promedio) más por encima de su referencia p90; si ninguna la supera,
  // la etapa con más naves sobre la referencia; si no hay referencias, null.
  const candidatas = etapas
    .filter((e) => e.referenciaP90Min !== null && e.minutosPromedio !== null)
    .map((e) => ({ e, exceso: e.minutosPromedio / e.referenciaP90Min }))
    .filter((c) => c.exceso > 1 || c.e.sobreReferencia > 0)
    .sort((a, b) => b.exceso - a.exceso || b.e.sobreReferencia - a.e.sobreReferencia);
  const cuello = candidatas[0]?.e || null;

  const criticas = ais.filter((n) => ESTADOS_CRITICOS.includes(n.estado));
  return {
    puerto,
    generadoEn: ahora.toISOString(),
    horas,
    aisDisponible: navesAis !== null,
    avisosDisponibles: llegadas !== null,
    etapas,
    cuelloDeBotella: cuello ? {
      etapa: cuello.codigo,
      texto: `${cuello.nombre}: ${cuello.sobreReferencia} de ${cuello.naves} naves superan la espera habitual (p90 ${Math.round(cuello.referenciaP90Min / 60 * 10) / 10} h)`,
    } : null,
    criticas: { naves: criticas.length, lista: criticas },
    totalEnPuerto: etapas.filter((e) => e.codigo !== 'AVISADA').reduce((t, e) => t + e.naves, 0),
  };
}

module.exports = { ETAPAS_EMBUDO: ETAPAS, armarEmbudo };
