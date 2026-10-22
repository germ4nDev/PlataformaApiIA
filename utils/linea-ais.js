/*
    Author: German Valencia
    Pattern: PORTTOS Núcleo puro (AD-16) - Line-up frente a AIS
    Description: Identidad de muelles y barcos para cruzar el line-up (nombre de motonave, terminal, muelle)
      con lo que ve el AIS. Lo usan el resumen de terminales (maritimo.service) y el estado de muelles
      del mapa (utils/estado-muelles.js). Sin red ni base.
*/

const claveMuelle = (idTerminal, codigoMuelle) =>
  `${String(idTerminal || '').trim().toUpperCase()}|${String(codigoMuelle || '').trim().toUpperCase()}`;

/** Compara nombres de barco sin espacios, signos ni prefijos (MV, M/V, M/N). */
const normalizarNombreBarco = (nombre) =>
  String(nombre || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^(M\/?V|M\/?N|MN|MT)\s+/, '')
    .replace(/[^A-Z0-9]/g, '');

const mismoBarco = (a, b) => {
  const x = normalizarNombreBarco(a);
  const y = normalizarNombreBarco(b);
  return Boolean(x && y) && (x === y || (Math.min(x.length, y.length) >= 5 && (x.includes(y) || y.includes(x))));
};

/**
 * Estado del muelle según el AIS frente al line-up:
 * CONFIRMADO, SIN_CONFIRMAR (line-up sí, AIS no), DISCREPANCIA (AIS ve otro barco),
 * NO_REPORTADO (AIS ve un barco que el line-up no tiene), LIBRE o SIN_DATOS (sin AIS en el puerto).
 */
function verificarConAis(barcoLineUp, navesAis) {
  const naves = (navesAis || []).map((n) => ({ mmsi: n.mmsi, nombre: n.nombre || null, minutos: n.minutos ?? null }));
  if (navesAis === null) return { estado: 'SIN_DATOS', texto: 'Sin datos AIS', naves: [] };
  if (barcoLineUp && naves.some((n) => mismoBarco(n.nombre, barcoLineUp))) {
    return { estado: 'CONFIRMADO', texto: 'Confirmado por AIS', naves };
  }
  if (barcoLineUp && naves.length) {
    return { estado: 'DISCREPANCIA', texto: `AIS ve: ${naves.map((n) => n.nombre || n.mmsi).join(', ')}`, naves };
  }
  if (barcoLineUp) return { estado: 'SIN_CONFIRMAR', texto: 'AIS no lo ve atracado', naves };
  if (naves.length) return { estado: 'NO_REPORTADO', texto: 'Atracado según AIS, no está en el line-up', naves };
  return { estado: 'LIBRE', texto: 'Libre', naves };
}

module.exports = { claveMuelle, normalizarNombreBarco, mismoBarco, verificarConAis };
