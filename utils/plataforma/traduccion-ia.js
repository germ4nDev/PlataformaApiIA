/*
    Author: German Valencia
    Pattern: PLATAFORMA Núcleo puro - Idiomas del maestro y traducción por lotes de un idioma nuevo (CC-215, AD-16; sin archivos ni red)
    Description:
      Regla única de idiomas (usuario, 2026-11-16): se editan y se publican los idiomas ACTIVOS en el maestro (PTL_Idiomas) que tienen
      archivo en Traducciones; el español va siempre primero. Un idioma activo sin archivo se crea con todas sus llaves traducidas.
      idiomasEditables(maestro, conArchivo)    ['es', …activos con archivo, en orden]
      porTraducir(planoEs, hechas)             [[llave, texto]] del español que faltan en el idioma (textos vacíos no se mandan)
      lotes(entradas, { maxLlaves, maxCaracteres })   grupos para el modelo
      marcadores(texto)                        {{parámetros}} y etiquetas HTML que la traducción debe conservar
      revisarLote(lote, respuesta)             { buenas: { llave: texto }, malas: [llaves] }: misma llave, texto no vacío, mismos marcadores
      ensamblar(arbolEs, traducidas)           { arbol, traducidas, sinTraducir }: el árbol del español con lo traducido (lo que falte, en español)
      solicitudLote({ sigla, nombre, lote })   { sistema, mensajes, herramienta } para el adaptador de IA (salida forzada)
*/
const N = require('./traducciones');

const vacio = (v) => v === null || v === undefined || String(v).trim() === '';

function idiomasEditables(maestro, conArchivo) {
  const activos = new Set((maestro || []).map((m) => N.siglaArchivo(typeof m === 'string' ? m : m?.sigla)).filter(Boolean));
  const hay = new Set(conArchivo || []);
  return ['es', ...[...activos].filter((i) => i !== 'es' && hay.has(i)).sort()];
}

function porTraducir(planoEs, hechas = {}) {
  return Object.entries(planoEs || {}).filter(([llave, texto]) => typeof texto === 'string' && !vacio(texto) && vacio(hechas[llave]));
}

function lotes(entradas, { maxLlaves = 100, maxCaracteres = 6000 } = {}) {
  const out = [];
  let actual = [];
  let tam = 0;
  for (const e of entradas || []) {
    const t = String(e[1]).length + e[0].length;
    if (actual.length && (actual.length >= maxLlaves || tam + t > maxCaracteres)) { out.push(actual); actual = []; tam = 0; }
    actual.push(e);
    tam += t;
  }
  if (actual.length) out.push(actual);
  return out;
}

function marcadores(texto) {
  const s = String(texto ?? '');
  const params = (s.match(/\{\{\s*[\w.]+\s*\}\}/g) || []).map((p) => p.replace(/\s+/g, ''));
  const etiquetas = (s.match(/<\/?[a-zA-Z][a-zA-Z0-9]*/g) || []).map((x) => x.toLowerCase());
  return [...params, ...etiquetas].sort().join('|');
}

/** La respuesta del modelo: [{ llave, texto }] (o un objeto { llave: texto }) */
function revisarLote(lote, respuesta) {
  const lista = Array.isArray(respuesta) ? respuesta : Object.entries(respuesta || {}).map(([llave, texto]) => ({ llave, texto }));
  const dadas = new Map(lista.filter((x) => x && typeof x.llave === 'string').map((x) => [x.llave, x.texto]));
  const buenas = {};
  const malas = [];
  for (const [llave, es] of lote) {
    const t = dadas.get(llave);
    if (typeof t === 'string' && !vacio(t) && marcadores(t) === marcadores(es)) buenas[llave] = t;
    else malas.push(llave);
  }
  return { buenas, malas };
}

function ensamblar(arbolEs, traducidas = {}) {
  const plano = N.plano(arbolEs || {});
  let arbol = JSON.parse(JSON.stringify(arbolEs || {}));
  let n = 0;
  const sinTraducir = [];
  for (const [llave, es] of Object.entries(plano)) {
    if (typeof es !== 'string' || vacio(es)) continue;
    if (!vacio(traducidas[llave])) { arbol = N.poner(arbol, llave, traducidas[llave]); n++; } else sinTraducir.push(llave);
  }
  return { arbol, traducidas: n, sinTraducir };
}

const HERRAMIENTA = Object.freeze({
  name: 'entregar_traducciones',
  description: 'Entrega la traducción de cada texto, con la misma llave que trae.',
  input_schema: {
    type: 'object',
    properties: {
      traducciones: {
        type: 'array',
        items: { type: 'object', properties: { llave: { type: 'string' }, texto: { type: 'string' } }, required: ['llave', 'texto'] },
      },
    },
    required: ['traducciones'],
  },
});

function solicitudLote({ sigla, nombre, lote }) {
  const destino = nombre ? `${nombre} (${sigla})` : sigla;
  const sistema = [{
    cache: true,
    texto: [
      `Eres traductor profesional de interfaces de software. Traduces del español al idioma ${destino}.`,
      'Los textos son de una plataforma web de gestión (usuarios, roles, suscriptores, licencias) y de Porttos, una torre de control',
      'logística de puertos (buques, muelles, contenedores, bodegas, granel, GNL, accesos terrestres).',
      'Reglas: traduce cada texto con el tono de una interfaz (breve y claro); conserva exactamente los parámetros {{asi}} y las',
      'etiquetas HTML; no traduzcas nombres propios ni marcas (Porttos, Virtual Gate, Plataforma IA, nombres de puertos y entidades);',
      'conserva siglas técnicas (KPI, AIS, ETA, JSON, URL) y usa la sigla equivalente cuando el idioma tenga una establecida;',
      'conserva signos, mayúsculas iniciales y puntuación final del original. Devuelve todas las llaves con la herramienta.',
    ].join(' '),
  }];
  const mensajes = [{ role: 'user', content: JSON.stringify(Object.fromEntries(lote)) }];
  return { sistema, mensajes, herramienta: HERRAMIENTA };
}

module.exports = { idiomasEditables, porTraducir, lotes, marcadores, revisarLote, ensamblar, solicitudLote, HERRAMIENTA };
