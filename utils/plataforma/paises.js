/*
    Author: German Valencia
    Pattern: PLATAFORMA Núcleo puro - Países (Utilidades › Países; los usa Listas de precios) (AD-16; sin base ni red)
      normalizar(p)          mayúsculas en los códigos ISO, trim, decimales a número, '' → null en los opcionales
      revisar(p)             [] o la lista de { campo, mensaje } (ISO 3166-1 alfa-2/alfa-3/numérico, ISO 4217, indicativo, zona IANA, idioma)
      zonaValida(zona)       true si el runtime conoce la zona horaria IANA (America/Bogota)
*/
const t = (v) => (v === undefined || v === null ? '' : String(v).trim());
const opcional = (v) => (t(v) === '' ? null : t(v));

function zonaValida(zona) {
  if (!t(zona)) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: t(zona) }); return true; } catch { return false; }
}

function normalizar(p = {}) {
  return {
    codigoPais: t(p.codigoPais).toUpperCase(),
    codigoIso3: t(p.codigoIso3).toUpperCase(),
    codigoNumerico: opcional(p.codigoNumerico),
    nombrePais: t(p.nombrePais),
    moneda: t(p.moneda).toUpperCase(),
    simboloMoneda: opcional(p.simboloMoneda),
    decimalesMoneda: p.decimalesMoneda === '' || p.decimalesMoneda === undefined || p.decimalesMoneda === null ? 2 : Number(p.decimalesMoneda),
    indicativo: opcional(p.indicativo),
    zonaHoraria: opcional(p.zonaHoraria),
    idioma: opcional(p.idioma),
    descripcion: opcional(p.descripcion),
    estadoPais: p.estadoPais === undefined ? true : p.estadoPais === true || p.estadoPais === 1 || p.estadoPais === 'true',
  };
}

function revisar(p) {
  const e = [];
  const mal = (campo, mensaje) => e.push({ campo, mensaje });
  if (!/^[A-Z]{2}$/.test(p.codigoPais)) mal('codigoPais', 'Código ISO 3166-1 alfa-2: dos letras (CO).');
  if (!/^[A-Z]{3}$/.test(p.codigoIso3)) mal('codigoIso3', 'Código ISO 3166-1 alfa-3: tres letras (COL).');
  if (p.codigoNumerico !== null && !/^\d{3}$/.test(p.codigoNumerico)) mal('codigoNumerico', 'Código numérico ISO: tres dígitos (170).');
  if (!p.nombrePais || p.nombrePais.length > 100) mal('nombrePais', 'El nombre es obligatorio (máx. 100).');
  if (!/^[A-Z]{3}$/.test(p.moneda)) mal('moneda', 'Moneda ISO 4217: tres letras (COP).');
  if (p.simboloMoneda !== null && p.simboloMoneda.length > 5) mal('simboloMoneda', 'Símbolo de máximo 5 caracteres.');
  if (!Number.isInteger(p.decimalesMoneda) || p.decimalesMoneda < 0 || p.decimalesMoneda > 4) mal('decimalesMoneda', 'Decimales de 0 a 4.');
  if (p.indicativo !== null && !/^\+\d{1,4}$/.test(p.indicativo)) mal('indicativo', 'Indicativo con + y de 1 a 4 dígitos (+57).');
  if (p.zonaHoraria !== null && !zonaValida(p.zonaHoraria)) mal('zonaHoraria', 'Zona horaria IANA no reconocida (America/Bogota).');
  if (p.idioma !== null && !/^[a-z]{2}(-[A-Z]{2})?$/.test(p.idioma)) mal('idioma', 'Idioma como es o es-CO.');
  if (p.descripcion !== null && p.descripcion.length > 4000) mal('descripcion', 'Descripción de máximo 4000 caracteres.');
  return e;
}

module.exports = { normalizar, revisar, zonaValida };
