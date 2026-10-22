/*
    Author: German Valencia
    Pattern: PORTTOS Núcleo puro (AD-16) - Estado de muelles para el mapa
    Description: Cruza los muelles del maestro (con su polígono), las naves que el AIS ve atracadas y el
      line-up (atracadas y próximos atraques) y devuelve un GeoJSON con el estado de cada muelle:
        MANTENIMIENTO > OCUPADO > RESERVADO > LIBRE
      OCUPADO lleva su fuente (AIS, line-up o ambos) y la verificación line-up vs AIS (utils/linea-ais.js).
      Propiedades planas: MapLibre no lee objetos anidados. Sin red ni base.
*/
const { claveMuelle, verificarConAis } = require('./linea-ais');

const ESTADOS_MUELLE = Object.freeze({
  MANTENIMIENTO: 'MANTENIMIENTO',
  OCUPADO: 'OCUPADO',
  RESERVADO: 'RESERVADO',
  LIBRE: 'LIBRE',
});

const numero = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

/**
 * @param {object} p
 * @param {Array<{idInterno, codigoMuelle, idTerminal, terminal, especialidad, caladoMetros, enMantenimiento, geometria}>} p.muelles
 *        geometria = GeoJSON (Polygon/MultiPolygon) o null
 * @param {Array<{mmsi, nombre, idTerminal, codigoMuelle, minutos}>|null} p.navesAis  null = sin datos AIS en el puerto
 * @param {Array<{terminal, muelle, motonave, eslora, atracada, minutosParaAtraque}>} p.lineUp
 * @param {number} [p.horasReserva=24]  ventana de "reservado"
 */
function armarEstadoMuelles({ muelles = [], navesAis = null, lineUp = [], horasReserva = 24, ahora = new Date() }) {
  const aisPorMuelle = new Map();
  (navesAis || []).forEach((n) => {
    const k = claveMuelle(n.idTerminal, n.codigoMuelle);
    if (!aisPorMuelle.has(k)) aisPorMuelle.set(k, []);
    aisPorMuelle.get(k).push(n);
  });
  const luPorMuelle = new Map();
  (lineUp || []).forEach((l) => {
    const k = claveMuelle(l.terminal, l.muelle);
    if (!luPorMuelle.has(k)) luPorMuelle.set(k, []);
    luPorMuelle.get(k).push(l);
  });

  const features = [];
  const sinGeometria = [];
  const porEstado = { MANTENIMIENTO: 0, OCUPADO: 0, RESERVADO: 0, LIBRE: 0 };

  muelles.forEach((m) => {
    const k = claveMuelle(m.idTerminal, m.codigoMuelle);
    const ais = navesAis === null ? null : aisPorMuelle.get(k) || [];
    const filas = luPorMuelle.get(k) || [];
    const atracadasLU = filas.filter((l) => Number(l.atracada) === 1);
    const proximos = filas
      .filter((l) => Number(l.atracada) !== 1 && numero(l.minutosParaAtraque) !== null
        && l.minutosParaAtraque >= 0 && l.minutosParaAtraque <= horasReserva * 60)
      .sort((a, b) => a.minutosParaAtraque - b.minutosParaAtraque);

    const barcoLU = atracadasLU[0]?.motonave || null;
    const verificacion = verificarConAis(barcoLU, ais);

    let estado;
    let fuente = null;
    if (m.enMantenimiento) estado = ESTADOS_MUELLE.MANTENIMIENTO;
    else if (ais && ais.length) { estado = ESTADOS_MUELLE.OCUPADO; fuente = verificacion.estado === 'CONFIRMADO' ? 'AIS_Y_LINEUP' : 'AIS'; }
    else if (atracadasLU.length) { estado = ESTADOS_MUELLE.OCUPADO; fuente = 'LINEUP'; }
    else if (proximos.length) estado = ESTADOS_MUELLE.RESERVADO;
    else estado = ESTADOS_MUELLE.LIBRE;
    porEstado[estado]++;

    const naveAis = ais && ais.length ? ais[0] : null;
    const proximo = proximos[0] || null;
    const propiedades = {
      id: m.idInterno ?? k,
      clave: k,
      codigoMuelle: m.codigoMuelle,
      idTerminal: m.idTerminal,
      terminal: m.terminal || m.idTerminal,
      especialidad: m.especialidad || null,
      caladoMetros: numero(m.caladoMetros),
      estado,
      fuente,
      verificacion: verificacion.estado,
      verificacionTexto: verificacion.texto,
      nave: naveAis?.nombre || barcoLU || null,
      mmsi: naveAis?.mmsi || null,
      eslora: numero(atracadasLU[0]?.eslora),
      minutosAtracada: numero(naveAis?.minutos),
      navesEnMuelle: ais ? ais.length : atracadasLU.length,
      proximoMotonave: proximo?.motonave || null,
      proximoEnMinutos: numero(proximo?.minutosParaAtraque),
      proximaEslora: numero(proximo?.eslora),
      reservasVentana: proximos.length,
      etiqueta: m.codigoMuelle,
    };

    if (!m.geometria || !['Polygon', 'MultiPolygon'].includes(m.geometria.type)) {
      sinGeometria.push(`${m.idTerminal} · ${m.codigoMuelle}`);
      return;
    }
    features.push({ type: 'Feature', properties: propiedades, geometry: m.geometria });
  });

  return {
    type: 'FeatureCollection',
    generadoEn: ahora.toISOString(),
    horasReserva,
    aisDisponible: navesAis !== null,
    resumen: { muelles: muelles.length, conGeometria: features.length, porEstado, sinGeometria },
    features,
  };
}

module.exports = { ESTADOS_MUELLE, armarEstadoMuelles };
