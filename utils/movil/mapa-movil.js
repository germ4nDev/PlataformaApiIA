/*
    Author: German Valencia
    Pattern: PORTTOS Núcleo puro (AD-16) - Mapa logístico de la app móvil (fase 4)
    Description: Convierte las capas que ya arma la web (naves AIS, flota terrestre, eventos viales) en un solo paquete
      liviano para el teléfono. Sin base de datos ni red.
        armarMapa({ puerto, cajaMaritima, cajaTerrestre, naves, flota, eventos, ahora }) →
          { puerto, generadoEn, centro: [lon, lat] | null, limites: [[oeste, sur], [este, norte]] | null,
            naves: FeatureCollection, camiones: FeatureCollection, eventos: FeatureCollection, conteos }
      - Descarta coordenadas inválidas o (0, 0) y respeta un máximo por capa (MAX_*).
      - Solo lleva lo que la app muestra: sin datos personales (no viaja el conductor).
      - Estado de la nave normalizado: atracada | fondeada | movimiento | avisada | zarpada | sin_dato.
*/

const MAX_NAVES = 600;
const MAX_CAMIONES = 800;
const MAX_EVENTOS = 200;
const VELOCIDAD_QUIETA_NUDOS = 0.5;

const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const texto = (v, max = 80) => (v === null || v === undefined ? null : String(v).trim().slice(0, max) || null);

function coordenadaValida(lon, lat) {
  return Number.isFinite(lon) && Number.isFinite(lat) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !(lon === 0 && lat === 0);
}

function punto(lon, lat, properties) {
  return { type: 'Feature', geometry: { type: 'Point', coordinates: [Math.round(lon * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5] }, properties };
}

const coleccion = (features) => ({ type: 'FeatureCollection', features });

/** Estado operativo de la nave a partir del perfil (DIMAR) y de la velocidad AIS. */
function estadoNave(estadoPerfil, velocidad) {
  const e = String(estadoPerfil || '').toUpperCase();
  if (e.startsWith('ARRIBAD') || e.startsWith('ATRACAD')) return 'atracada';
  if (e.startsWith('FONDEAD')) return 'fondeada';
  if (e.startsWith('ZARPAD')) return 'zarpada';
  const v = num(velocidad);
  if (v !== null && v > VELOCIDAD_QUIETA_NUDOS) return 'movimiento';
  if (e.startsWith('AVISAD')) return 'avisada';
  return 'sin_dato';
}

const minutosDesde = (iso, ahoraMs) => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.max(0, Math.round((ahoraMs - t) / 60000)) : null;
};

function navesMovil(fc, ahoraMs) {
  const lista = Array.isArray(fc?.features) ? fc.features : [];
  return lista.map((f) => {
    const [lon, lat] = (f?.geometry?.coordinates || []).map(Number);
    if (!coordenadaValida(lon, lat)) return null;
    const p = f.properties || {};
    return punto(lon, lat, {
      id: String(p.mmsi ?? p.omi ?? `${lon},${lat}`),
      nombre: texto(p.nombre_motonave || p.motonave) || String(p.mmsi || 'Nave'),
      estado: estadoNave(p.estado_nave, p.velocidad),
      velocidad: num(p.velocidad),
      rumbo: num(p.rumbo),
      tipo: texto(p.tipo_nave, 40),
      instalacion: texto(p.instalacion_portuaria, 60),
      agencia: texto(p.agencia, 60),
      eta: texto(p.eta, 30),
      minutos: minutosDesde(p.ultima_posicion, ahoraMs),
    });
  }).filter(Boolean).slice(0, MAX_NAVES);
}

function camionesMovil(fc) {
  const lista = Array.isArray(fc?.features) ? fc.features : [];
  return lista.map((f) => {
    const [lon, lat] = (f?.geometry?.coordinates || []).map(Number);
    if (!coordenadaValida(lon, lat)) return null;
    const p = f.properties || {};
    return punto(lon, lat, {
      id: texto(p.placa, 20) || `${lon},${lat}`,
      placa: texto(p.placa, 20),
      estado: texto(p.estado, 30) || 'EN_RUTA',
      velocidad: num(p.velocidad),
      rumbo: num(p.rumbo),
      tipo: texto(p.tipo_camion, 40),
    });
  }).filter(Boolean).slice(0, MAX_CAMIONES);
}

function eventosMovil(eventos) {
  return (Array.isArray(eventos) ? eventos : []).map((e) => {
    const lon = num(e?.lon);
    const lat = num(e?.lat);
    if (!coordenadaValida(lon, lat)) return null;
    const tipo = String(e.tipoEvento || '').toUpperCase();
    const grave = ['CIERRE_VIAL', 'ACCIDENTE'].includes(tipo) || /alta|critic/i.test(String(e.nivelSeveridad || ''));
    return punto(lon, lat, {
      id: texto(e.codigoEvento, 60) || `${lon},${lat}`,
      tipo, descripcion: texto(e.descripcion, 160), corredor: texto(e.corredorVial, 80), sector: texto(e.sector, 80),
      grave,
    });
  }).filter(Boolean).slice(0, MAX_EVENTOS);
}

function armarMapa({ puerto, cajaMaritima = null, cajaTerrestre = null, naves, flota, eventos, ahora = new Date() }) {
  const n = navesMovil(naves, ahora.getTime());
  const c = camionesMovil(flota);
  const e = eventosMovil(eventos);
  const caja = cajaMaritima || cajaTerrestre;
  return {
    puerto,
    generadoEn: ahora.toISOString(),
    centro: caja ? [(caja.oeste + caja.este) / 2, (caja.sur + caja.norte) / 2] : null,
    limites: caja ? [[caja.oeste, caja.sur], [caja.este, caja.norte]] : null,
    naves: coleccion(n),
    camiones: coleccion(c),
    eventos: coleccion(e),
    conteos: {
      naves: n.length,
      fondeadas: n.filter((f) => f.properties.estado === 'fondeada').length,
      atracadas: n.filter((f) => f.properties.estado === 'atracada').length,
      enMovimiento: n.filter((f) => f.properties.estado === 'movimiento').length,
      camiones: c.length,
      eventos: e.length,
      eventosGraves: e.filter((f) => f.properties.grave).length,
    },
  };
}

module.exports = { MAX_NAVES, MAX_CAMIONES, MAX_EVENTOS, coordenadaValida, estadoNave, navesMovil, camionesMovil, eventosMovil, armarMapa };
