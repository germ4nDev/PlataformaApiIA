/*
    Author: German Valencia
    Pattern: PORTTOS Helper
    Descripción: Geometría segura para SQL Server.

    Problema que resuelve: los servicios armaban `geometry::STGeomFromText('${wkt}', 4326)` con coordenadas
    que llegaban del cliente sin validar → inyección SQL (p. ej. coordinates: [["0 0))', 4326); DROP TABLE x;--", 0]]).

    Regla: el WKT se construye SOLO con números validados (Number finito y en rango), y cualquier WKT que llegue
    como texto se rechaza si contiene algo distinto de dígitos, signo, punto, exponente, coma, espacio o paréntesis.
    Así el literal no puede contener comillas ni SQL. Un error lanza { type: 'ValidationError' } → 400 en los controladores.
*/
const SRID_PORTTOS = 4326;
const PATRON_NUMERO = /^-?\d+(\.\d+)?([eE][-+]?\d+)?$/;
const PATRON_WKT = /^\s*(POINT|POLYGON|MULTIPOLYGON)\s*\([0-9eE+\-.,()\s]*\)\s*$/i;

const errorValidacion = (campo, mensaje) => ({
  type: 'ValidationError',
  statusCode: 400,
  details: [{ campo, mensaje }],
});

/** Acepta números o textos numéricos estrictos ("-77.1"); cualquier otra cosa es inválida. */
function numero(valor, campo) {
  const n = typeof valor === 'number' ? valor
    : typeof valor === 'string' && PATRON_NUMERO.test(valor.trim()) ? Number(valor.trim()) : NaN;
  if (!Number.isFinite(n)) throw errorValidacion(campo, 'las coordenadas deben ser números');
  return n;
}

function posicion(par, campo) {
  if (!Array.isArray(par) || par.length < 2) throw errorValidacion(campo, 'cada coordenada debe ser [longitud, latitud]');
  const lon = numero(par[0], campo);
  const lat = numero(par[1], campo);
  if (Math.abs(lon) > 180 || Math.abs(lat) > 90) throw errorValidacion(campo, `coordenada fuera de rango: [${lon}, ${lat}]`);
  return `${lon} ${lat}`;
}

function anillo(puntos, campo) {
  if (!Array.isArray(puntos) || puntos.length < 3) throw errorValidacion(campo, 'un anillo necesita al menos 3 puntos');
  const texto = puntos.map((p) => posicion(p, campo));
  if (texto[0] !== texto[texto.length - 1]) texto.push(texto[0]); // SQL Server exige el anillo cerrado
  if (texto.length < 4) throw errorValidacion(campo, 'un anillo necesita al menos 3 puntos distintos');
  return `(${texto.join(', ')})`;
}

const poligono = (anillos, campo) => {
  if (!Array.isArray(anillos) || anillos.length === 0) throw errorValidacion(campo, 'polígono sin anillos');
  return `(${anillos.map((a) => anillo(a, campo)).join(', ')})`;
};

/** Geometría directa, Feature o FeatureCollection (toma la primera feature, como hacían los DTO). */
function extraerGeometria(geo) {
  if (!geo || typeof geo !== 'object') return null;
  if (geo.type === 'FeatureCollection') return geo.features?.[0]?.geometry ?? null;
  if (geo.type === 'Feature') return geo.geometry ?? null;
  return geo;
}

/** GeoJSON (Point, Polygon, MultiPolygon) → WKT construido solo con números validados. */
function geojsonAWktSeguro(geo, campo = 'geometria') {
  const g = extraerGeometria(geo);
  if (!g) return null;
  switch (g.type) {
    case 'Point':
      return `POINT(${posicion(g.coordinates, campo)})`;
    case 'Polygon':
      return `POLYGON${poligono(g.coordinates, campo)}`;
    case 'MultiPolygon':
      if (!Array.isArray(g.coordinates) || g.coordinates.length === 0) throw errorValidacion(campo, 'multipolígono vacío');
      return `MULTIPOLYGON(${g.coordinates.map((p) => poligono(p, campo)).join(', ')})`;
    default:
      throw errorValidacion(campo, `tipo de geometría no soportado: ${String(g.type).slice(0, 30)}`);
  }
}

/** Valida un WKT que ya viene como texto: solo se permiten números y la sintaxis WKT. */
function wktSeguro(wkt, campo = 'geometria') {
  if (typeof wkt !== 'string' || !PATRON_WKT.test(wkt)) throw errorValidacion(campo, 'geometría WKT inválida');
  return wkt.trim();
}

/**
 * Sequelize.literal seguro para una columna geometry.
 * @param S       Sequelize (clase) o la instancia, lo que el servicio ya use para .literal
 * @param geo     GeoJSON (objeto) o WKT (texto)
 * @param srid    4326 por defecto (convención Porttos)
 */
function literalGeometria(S, geo, srid = SRID_PORTTOS, campo = 'geometria') {
  const wkt = typeof geo === 'string' ? wktSeguro(geo, campo) : geojsonAWktSeguro(geo, campo);
  if (!wkt) return null;
  const sridSeguro = Number.isInteger(srid) ? srid : SRID_PORTTOS;
  return S.literal(`geometry::STGeomFromText('${wkt}', ${sridSeguro})`);
}

function literalPunto(S, lon, lat, srid = SRID_PORTTOS, campo = 'ubicacion') {
  return literalGeometria(S, { type: 'Point', coordinates: [lon, lat] }, srid, campo);
}

module.exports = {
  SRID_PORTTOS,
  extraerGeometria,
  geojsonAWktSeguro,
  wktSeguro,
  literalGeometria,
  literalPunto,
};
