/*
    Author: German Valencia
    Pattern: PLATAFORMA Núcleo puro - Pestañas y tipos de pestaña (Utilidades, CC-203; patrón de los módulos de administración)
    Sin acceso a datos (AD-16); probado en _pruebas/admin-pestanas.test.js.
      ESTRATEGIAS                       estrategias del motor de tableros (PTL_TiposPestana.estrategia)
      normalizarColor(v) / normalizarIcono(v)
      normalizarPestana(p) / revisarPestana(p)   → [{ campo, mensaje }]
      normalizarTipo(t) / revisarTipo(t)         → [{ campo, mensaje }]
    Ícono: nombre neutro (barco, camion, bodega…) que cada aplicación dibuja a su manera (web Font Awesome, app SVG).
*/
const ESTRATEGIAS = Object.freeze(['CASCADA_DINAMICA', 'ESTATICO_ANALITICO', 'FLUJO_PROCESO', 'LIENZO_ESPACIAL']);
const CODIGO = /^[A-Z0-9_]{3,50}$/;
const COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const ICONO = /^[a-z0-9][a-z0-9 _-]{0,59}$/i;

const texto = (v) => (v === null || v === undefined ? '' : String(v).trim());
const nulo = (v) => (texto(v) === '' ? null : texto(v));
const bool = (v, def = true) => (v === undefined || v === null || v === '' ? def : v === true || v === 1 || v === '1' || v === 'true');

function normalizarColor(v) {
  const t = texto(v);
  return t ? t.toLowerCase() : null;
}

function normalizarIcono(v) {
  const t = texto(v).replace(/\s+/g, ' ');
  return t || null;
}

function normalizarPestana(p = {}) {
  const orden = Number.parseInt(p.orden, 10);
  return {
    codigoPestana: texto(p.codigoPestana).toUpperCase(),
    codigoTipoPestana: texto(p.codigoTipoPestana),
    codigoAplicacion: texto(p.codigoAplicacion),
    codigoSuite: texto(p.codigoSuite),
    nombrePestana: texto(p.nombrePestana),
    orden: Number.isFinite(orden) && orden >= 0 ? orden : 0,
    descripcion: nulo(p.descripcion),
    estado: bool(p.estado, true),
    icono: normalizarIcono(p.icono),
    color: normalizarColor(p.color),
  };
}

function revisarPestana(p) {
  const e = [];
  if (!CODIGO.test(p.codigoPestana)) e.push({ campo: 'codigoPestana', mensaje: 'El código va en mayúsculas, números y guion bajo (3 a 50), p. ej. TLC_MARITIMO_001.' });
  if (!p.codigoTipoPestana) e.push({ campo: 'codigoTipoPestana', mensaje: 'Elija el tipo de pestaña.' });
  if (!p.codigoAplicacion) e.push({ campo: 'codigoAplicacion', mensaje: 'Elija la aplicación.' });
  if (!p.codigoSuite) e.push({ campo: 'codigoSuite', mensaje: 'Elija la suite.' });
  if (!p.nombrePestana || p.nombrePestana.length > 100) e.push({ campo: 'nombrePestana', mensaje: 'El nombre es obligatorio (máximo 100).' });
  if (p.descripcion && p.descripcion.length > 4000) e.push({ campo: 'descripcion', mensaje: 'La descripción admite máximo 4000 caracteres.' });
  if (p.color && !COLOR.test(p.color)) e.push({ campo: 'color', mensaje: 'El color va en hexadecimal, p. ej. #00bcd4.' });
  if (p.icono && !ICONO.test(p.icono)) e.push({ campo: 'icono', mensaje: 'El ícono es un nombre corto (letras, números, espacio o guion), p. ej. barco.' });
  return e;
}

function normalizarTipo(t = {}) {
  return {
    codigoTipo: texto(t.codigoTipo).toUpperCase(),
    estrategia: texto(t.estrategia).toUpperCase(),
    descripcion: nulo(t.descripcion),
    estado: bool(t.estado, true),
  };
}

function revisarTipo(t) {
  const e = [];
  if (!CODIGO.test(t.codigoTipo)) e.push({ campo: 'codigoTipo', mensaje: 'El código va en mayúsculas, números y guion bajo (3 a 50).' });
  if (!ESTRATEGIAS.includes(t.estrategia)) e.push({ campo: 'estrategia', mensaje: `La estrategia es una de: ${ESTRATEGIAS.join(', ')}.` });
  if (t.descripcion && t.descripcion.length > 500) e.push({ campo: 'descripcion', mensaje: 'La descripción admite máximo 500 caracteres.' });
  return e;
}

module.exports = { ESTRATEGIAS, normalizarColor, normalizarIcono, normalizarPestana, revisarPestana, normalizarTipo, revisarTipo };
