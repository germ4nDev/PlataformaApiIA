/*
    Author: German Valencia
    Pattern: PLATAFORMA Núcleo puro - Llaves de traducción en el árbol del JSON (OT-027, regla 22, AD-16; sin archivos ni red)
    Description:
      El árbol de es.json / en.json: primer nivel = módulo padre, dentro el submódulo (si lo hay) y dentro las llaves: MODULO.SUBMODULO.LLAVE.
      plano(arbol)                    { 'A.B.C': 'texto' } de todas las hojas
      revisarLlaveNueva(arbol, llave) null si se puede crear; si no, el motivo (FORMATO, SIN_MODULO, YA_EXISTE, ES_GRUPO, PADRE_ES_TEXTO)
      poner(arbol, llave, texto)      árbol nuevo con la hoja creada o cambiada, en su rama (crea los grupos que falten, al final)
      quitar(arbol, llave)            árbol nuevo sin la hoja y sin los grupos que queden vacíos
      ramas(arbol)                    [{ modulo, submodulos: [...] }] para elegir dónde crear
      filas(arboles)                  [{ llave, modulo, textos: { es, en… } }] de la unión de idiomas, por llave
*/
const SEGMENTO_NUEVO = /^[A-Z][A-Z0-9_]*$/; // las llaves nuevas, en MAYÚSCULAS (regla 22)
const esGrupo = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

function plano(arbol, pre = '', out = {}) {
  for (const [k, v] of Object.entries(arbol || {})) {
    if (esGrupo(v)) plano(v, pre + k + '.', out);
    else out[pre + k] = v;
  }
  return out;
}

function nodo(arbol, partes) {
  let x = arbol;
  for (const p of partes) {
    if (!esGrupo(x) || !(p in x)) return undefined;
    x = x[p];
  }
  return x;
}

function revisarLlaveNueva(arbol, llave) {
  const partes = String(llave || '').split('.');
  if (partes.length < 2) return 'SIN_MODULO';
  if (!partes.every((p) => SEGMENTO_NUEVO.test(p))) return 'FORMATO';
  for (let i = 1; i < partes.length; i++) {
    const padre = nodo(arbol, partes.slice(0, i));
    if (padre !== undefined && !esGrupo(padre)) return 'PADRE_ES_TEXTO';
  }
  const actual = nodo(arbol, partes);
  if (esGrupo(actual)) return 'ES_GRUPO';
  if (actual !== undefined) return 'YA_EXISTE';
  return null;
}

const clonar = (a) => JSON.parse(JSON.stringify(a || {}));

function poner(arbol, llave, texto) {
  const copia = clonar(arbol);
  const partes = String(llave).split('.');
  let x = copia;
  for (const p of partes.slice(0, -1)) {
    if (x[p] !== undefined && !esGrupo(x[p])) throw new Error('PADRE_ES_TEXTO');
    x = x[p] = x[p] || {};
  }
  const hoja = partes[partes.length - 1];
  if (esGrupo(x[hoja])) throw new Error('ES_GRUPO');
  x[hoja] = String(texto ?? '');
  return copia;
}

function quitar(arbol, llave) {
  const copia = clonar(arbol);
  const partes = String(llave).split('.');
  const camino = [copia];
  for (const p of partes.slice(0, -1)) {
    const sig = camino[camino.length - 1][p];
    if (!esGrupo(sig)) return copia; // no existe: nada que quitar
    camino.push(sig);
  }
  delete camino[camino.length - 1][partes[partes.length - 1]];
  for (let i = camino.length - 1; i > 0; i--) {
    if (Object.keys(camino[i]).length) break;
    delete camino[i - 1][partes[i - 1]];
  }
  return copia;
}

function ramas(arbol) {
  return Object.entries(arbol || {}).filter(([, v]) => esGrupo(v)).map(([modulo, v]) => ({
    modulo,
    submodulos: Object.entries(v).filter(([, w]) => esGrupo(w)).map(([s]) => s),
  }));
}

function filas(arboles) {
  const idiomas = Object.keys(arboles || {});
  const planos = Object.fromEntries(idiomas.map((i) => [i, plano(arboles[i])]));
  const llaves = new Set(idiomas.flatMap((i) => Object.keys(planos[i])));
  return [...llaves].map((llave) => ({
    llave,
    modulo: llave.split('.')[0],
    textos: Object.fromEntries(idiomas.map((i) => [i, planos[i][llave] ?? null])),
  }));
}

module.exports = { plano, revisarLlaveNueva, poner, quitar, ramas, filas, SEGMENTO_NUEVO };
