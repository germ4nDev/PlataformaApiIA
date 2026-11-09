/*
    Author: German Valencia
    Pattern: PORTTOS Núcleo puro (AD-16) - Layout del teléfono (OT-017 fase 2)
    Description: Sin red ni base de datos; lo prueba _pruebas/layout-telefono.test.js. Lo usa services/layout-telefono.
      Rejilla de la web embebida en el teléfono: COLUMNAS = 4 (la web usa 12). Un item es { codigo, x, y, cols, rows }.
        tamanoTelefono(widget)            tamaño por defecto desde el maestro (defaultCols/defaultRows de la web, en 12 columnas):
                                          angosto (≤ 3 columnas de la web) = media fila (2); el resto, ancho completo (4);
                                          alto = la mitad de las filas de la web, entre 1 y 6; el de ancho completo, mínimo
                                          MIN_FILAS_ANCHO (3: con 2 una tabla o gráfica no se lee en el teléfono; CC-122);
                                          el angosto, mínimo MIN_FILAS_ANGOSTO (2: el KPI queda de 2×2, casi cuadrado; CC-123)
        acomodar(items)                   coloca sin solapes: respeta la posición pedida si cabe; si no, el primer hueco
                                          libre (arriba-abajo, izquierda-derecha)
        layoutPorDefecto(widgets)         los widgets (ya filtrados: activos, de la pestaña y visibles en el teléfono) en el
                                          orden del maestro (pos_y, pos_x), acomodados
        sanear(recibido, permitidos)      lo que manda el teléfono: solo widgets permitidos, sin repetidos, dentro de la
                                          rejilla y sin solapes (máximo MAX_ITEMS)
        separar(guardado, visible)        { visibles, ocultos } de un layout guardado
        fusionar(saneados, guardado, visible) lo que se guarda: lo nuevo + lo oculto del guardado anterior (un widget que el
                                          rol dejó de permitir no se pierde del layout del usuario; como CC-115)
        disponibles(widgets, items)       widgets visibles que aún no están en el layout (catálogo «Agregar widget»)
*/

const COLUMNAS = 4;
const MAX_FILAS_ITEM = 8;
const MAX_FILA = 400;
const MAX_ITEMS = 60;
const MIN_FILAS_ANCHO = 3;
const MIN_FILAS_ANGOSTO = 2;

const entero = (v, min, max, porDefecto) => {
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n)) return porDefecto;
  return Math.min(max, Math.max(min, n));
};
const codigoLimpio = (v) => String(v ?? '').trim().toUpperCase();

/** Tamaño del widget en el teléfono a partir de su tamaño por defecto en la web (12 columnas). */
function tamanoTelefono(widget) {
  const colsWeb = entero(widget?.defaultCols, 1, 12, 4);
  const filasWeb = entero(widget?.defaultRows, 1, 40, 2);
  const cols = colsWeb <= 3 ? 2 : COLUMNAS;
  const minimo = cols === COLUMNAS ? MIN_FILAS_ANCHO : MIN_FILAS_ANGOSTO;
  return { cols, rows: Math.min(6, Math.max(minimo, Math.round(filasWeb / 2))) };
}

/** Coloca los items sin solapes, en el orden recibido. */
function acomodar(items) {
  const ocupado = new Set();
  const libre = (x, y, cols, rows) => {
    if (x < 0 || x + cols > COLUMNAS || y < 0) return false;
    for (let f = y; f < y + rows; f++) for (let c = x; c < x + cols; c++) if (ocupado.has(`${c},${f}`)) return false;
    return true;
  };
  const marcar = (x, y, cols, rows) => {
    for (let f = y; f < y + rows; f++) for (let c = x; c < x + cols; c++) ocupado.add(`${c},${f}`);
  };
  const resultado = [];
  for (const it of items) {
    let { x, y } = it;
    const { cols, rows } = it;
    if (!(Number.isInteger(x) && Number.isInteger(y) && libre(x, y, cols, rows))) {
      let encontrado = false;
      for (let f = 0; f <= MAX_FILA && !encontrado; f++) {
        for (let c = 0; c + cols <= COLUMNAS; c++) {
          if (libre(c, f, cols, rows)) { x = c; y = f; encontrado = true; break; }
        }
      }
      if (!encontrado) continue;
    }
    marcar(x, y, cols, rows);
    resultado.push({ ...it, x, y });
  }
  return resultado;
}

/** Layout por defecto de una pestaña en el teléfono. */
function layoutPorDefecto(widgets) {
  const orden = [...(widgets || [])].sort((a, b) =>
    entero(a.pos_y, 0, 9999, 0) - entero(b.pos_y, 0, 9999, 0)
    || entero(a.pos_x, 0, 9999, 0) - entero(b.pos_x, 0, 9999, 0)
    || codigoLimpio(a.codigoWidget).localeCompare(codigoLimpio(b.codigoWidget)));
  const vistos = new Set();
  const items = [];
  for (const w of orden) {
    const codigo = codigoLimpio(w.codigoWidget);
    if (!codigo || vistos.has(codigo)) continue;
    vistos.add(codigo);
    items.push({ codigo, ...tamanoTelefono(w) });
  }
  return acomodar(items.slice(0, MAX_ITEMS));
}

/** Normaliza un item recibido; null si no sirve. */
function itemValido(it) {
  const codigo = codigoLimpio(it?.codigo);
  if (!codigo || codigo.length > 200) return null;
  const cols = entero(it.cols, 1, COLUMNAS, 2);
  const rows = entero(it.rows, 1, MAX_FILAS_ITEM, 1);
  return {
    codigo,
    cols,
    rows,
    x: entero(it.x, 0, COLUMNAS - cols, 0),
    y: entero(it.y, 0, MAX_FILA, 0),
  };
}

/** Lo que manda el teléfono, saneado: permitidos (Set de códigos), sin repetidos, en la rejilla, sin solapes. */
function sanear(recibido, permitidos) {
  const vistos = new Set();
  const items = [];
  for (const crudo of Array.isArray(recibido) ? recibido : []) {
    const it = itemValido(crudo);
    if (!it || vistos.has(it.codigo) || !permitidos.has(it.codigo)) continue;
    vistos.add(it.codigo);
    items.push(it);
    if (items.length >= MAX_ITEMS) break;
  }
  // De arriba abajo: si dos se pisan, el de más arriba conserva su lugar
  items.sort((a, b) => a.y - b.y || a.x - b.x);
  return acomodar(items);
}

/** Parte un layout guardado en lo que el usuario puede ver hoy y lo que no (visible: (codigo) => boolean). */
function separar(guardado, visible) {
  const visibles = [];
  const ocultos = [];
  for (const crudo of Array.isArray(guardado) ? guardado : []) {
    const it = itemValido(crudo);
    if (!it) continue;
    (visible(it.codigo) ? visibles : ocultos).push(it);
  }
  return { visibles, ocultos };
}

/** Lo que se guarda: lo saneado + lo oculto del layout anterior (sin repetir códigos). */
function fusionar(saneados, guardado, visible) {
  const { ocultos } = separar(guardado, visible);
  const usados = new Set(saneados.map((i) => i.codigo));
  return [...saneados, ...ocultos.filter((o) => !usados.has(o.codigo))];
}

/** Widgets visibles (filas del maestro) que todavía no están en el layout, con su tamaño por defecto. */
function disponibles(widgets, items) {
  const enLayout = new Set((items || []).map((i) => i.codigo));
  const vistos = new Set();
  const lista = [];
  for (const w of widgets || []) {
    const codigo = codigoLimpio(w.codigoWidget);
    if (!codigo || enLayout.has(codigo) || vistos.has(codigo)) continue;
    vistos.add(codigo);
    lista.push({ codigo, nombre: w.nombreWidget || codigo, ...tamanoTelefono(w) });
  }
  return lista.sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));
}

module.exports = {
  COLUMNAS, MAX_FILAS_ITEM, MAX_ITEMS,
  tamanoTelefono, acomodar, layoutPorDefecto, sanear, separar, fusionar, disponibles,
};
