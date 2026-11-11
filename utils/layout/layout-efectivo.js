/*
    Author: German Valencia
    Pattern: PORTTOS Núcleo puro (AD-16) - Layout efectivo de una pestaña (OT-008, 2026-10-29)
    Description: UNA sola regla para la web y la app: qué widgets ve el usuario, dónde y de qué tamaño (rejilla de 12
      columnas). La web tiene una copia en TypeScript (PlataformaIA/.../layout-efectivo.ts) y _pruebas/layout-paridad.test.js
      verifica que las dos den lo mismo. Sin red ni base.

        layoutEfectivo({ usuario, plantilla, estados, terminales }) → { origen, celdas: [{ codigo, idClon?, x, y, cols, rows }] }
          - usuario: filas de PTL_Layouts del usuario (codigoWidget, posicion_x|x, posicion_y|y, cols, rows, layoutId?).
          - plantilla: { estrategia, widgetsEstaticos: [{ codigoWidget, x, y, cols, rows, anclaje, inicial }], zonaDinamica }
            (lo que entrega LayoutService.getPlantillaMaestra, el mismo de /api/layout/plantilla).
          - estados: { CODIGO: estadoWidget } del maestro; un widget con estado 0/false no entra al layout por defecto.
          - terminales: cuántas terminales tiene el puerto (Marítimo: una tarjeta TERM_SLOT_n por terminal).

      Reglas (las de layout-metadata-engine de la web, con las decisiones del usuario del 2026-10-29):
        1. Con filas del usuario → esas, con su posición y tamaño de la BD (origen 'usuario').
        2. Sin filas → plantilla: `inicial` verdadero y activo en el maestro (origen 'defecto').
           - Estrategias estáticas: posiciones de la BD; si todas están en (0,0), en flujo de izquierda a derecha.
           - CASCADA_DINAMICA: ABSOLUTO donde está; las terminales desde la zona dinámica de la BD; RELATIVO debajo de
             las terminales conservando su distancia a la zona.
        3. Terminales: si hay tarjetas guardadas se respetan sus posiciones; las que falten se ponen en la rejilla de la zona
           y lo que está debajo se corre lo que crezca o se encoja la zona. Sin tarjetas guardadas, van debajo de los KPI.
        4. Sin duplicados (por idClon o código); las que se pisan se acomodan como gridster (primer hueco libre); en orden
           de lectura (y, x).
      Sin layout de usuario ni plantilla → { origen: 'sin_layout', celdas: [] }: no se inventa una lista.
*/

const COLUMNAS = 12;
const MOLDE_TERMINAL = 'PTT_MAE_WGT_TERMINAL';
const ESTRATEGIA_CASCADA = 'CASCADA_DINAMICA';
const PATRON_SLOT = /^TERM_SLOT_(\d+)$/;
// Último recurso si la BD no trae ni zona dinámica ni tamaño de la tarjeta (es el tamaño de la tarjeta del registro de la web)
const TARJETA_RESPALDO = { cols: 4, rows: 3 };

const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const verdadero = (v) => v === undefined || v === null || v === true || v === 1 || String(v).toLowerCase() === 'true';
const activo = (estado) => !(estado === 0 || estado === false || String(estado) === '0' || String(estado).toLowerCase() === 'false');
const esTerminal = (c) => c.codigo === MOLDE_TERMINAL;

/** Una fila de la BD (usuario o maestro) → celda. TERM_SLOT_n → molde de terminal con su idClon. */
function celda(f) {
  const crudo = String(f?.codigoWidget ?? f?.codigo ?? '').trim().toUpperCase();
  if (!crudo) return null;
  const slot = PATRON_SLOT.test(crudo);
  return {
    codigo: slot ? MOLDE_TERMINAL : crudo,
    ...(slot ? { idClon: crudo } : {}),
    x: Math.max(0, num(f.x ?? f.posicion_x ?? f.pos_x) ?? 0),
    y: Math.max(0, num(f.y ?? f.posicion_y ?? f.pos_y) ?? 0),
    cols: Math.max(1, num(f.cols ?? f.defaultCols) ?? TARJETA_RESPALDO.cols),
    rows: Math.max(1, num(f.rows ?? f.defaultRows) ?? TARJETA_RESPALDO.rows),
    anclaje: String(f.anclaje ?? f.anclajeTipo ?? 'RELATIVO').toUpperCase(),
    layoutId: num(f.layoutId),
  };
}

const llave = (c) => c.idClon || c.codigo;

/** Sin duplicados: queda la fila más reciente (mayor layoutId) o, sin layoutId, la primera. */
function sinDuplicados(celdas) {
  const porLlave = new Map();
  for (const c of celdas) {
    const previa = porLlave.get(llave(c));
    if (!previa || (c.layoutId !== null && previa.layoutId !== null && c.layoutId > previa.layoutId)) porLlave.set(llave(c), c);
  }
  return [...porLlave.values()];
}

/** Zona de terminales: la de la BD; si falta un dato, el tamaño de la tarjeta y las que caben en 12 columnas. */
function zonaDe(zonaBD, inicioYPorDefecto = 0) {
  const cols = num(zonaBD?.colsPorItem) || TARJETA_RESPALDO.cols;
  const rows = num(zonaBD?.rowsPorItem) || TARJETA_RESPALDO.rows;
  return {
    x: num(zonaBD?.inicioX) ?? 0,
    y: num(zonaBD?.inicioY) ?? inicioYPorDefecto,
    cols, rows,
    porFila: num(zonaBD?.maxItemsPorFila) || Math.max(1, Math.floor(COLUMNAS / cols)),
  };
}

const ranura = (z, i) => ({ x: z.x + (i % z.porFila) * z.cols, y: z.y + Math.floor(i / z.porFila) * z.rows });
const altoZona = (z, n) => (n > 0 ? Math.ceil(n / z.porFila) * z.rows : 0);

function plantillaEstatica(widgets) {
  const tienePosiciones = widgets.some((w) => w.x > 0 || w.y > 0);
  if (tienePosiciones) {
    return widgets.map((w) => {
      const cols = Math.min(COLUMNAS, w.cols);
      return { ...w, cols, x: Math.min(w.x, COLUMNAS - cols) };
    });
  }
  // Plantilla antigua con todo en (0,0): en flujo, de izquierda a derecha
  let x = 0; let y = 0; let alto = 0;
  return widgets.map((w) => {
    const cols = Math.min(COLUMNAS, w.cols);
    if (x + cols > COLUMNAS) { x = 0; y += alto; alto = 0; }
    const c = { ...w, cols, x, y };
    x += cols;
    alto = Math.max(alto, w.rows);
    return c;
  });
}

function plantillaCascada(widgets, zonaBD, n) {
  const absolutos = widgets.filter((w) => w.anclaje === 'ABSOLUTO');
  const relativos = widgets.filter((w) => w.anclaje !== 'ABSOLUTO');
  const bajoAbsolutos = absolutos.length ? Math.max(...absolutos.map((w) => w.y + w.rows)) : 0;
  const z = zonaDe(zonaBD, bajoAbsolutos);
  const tarjetas = Array.from({ length: n }, (_, i) => ({ codigo: MOLDE_TERMINAL, idClon: `TERM_SLOT_${i}`, ...ranura(z, i), cols: z.cols, rows: z.rows, anclaje: 'DINAMICO', layoutId: null }));
  const finZona = z.y + altoZona(z, n);
  // Lo relativo va justo debajo de las terminales y conserva sus distancias entre sí (la web lo cerraba con compactUp)
  const inicioRelativos = relativos.length ? Math.min(...relativos.map((w) => w.y)) : finZona;
  return [...absolutos, ...tarjetas, ...relativos.map((w) => ({ ...w, y: finZona + Math.max(0, w.y - inicioRelativos) }))];
}

/**
 * Tarjetas de terminal para las `n` terminales del puerto sobre un layout ya armado (usuario, plantilla o arrastre local).
 * @param {Array} celdas
 * @param {number} n
 * @param {object|null} zonaBD
 */
function ajustarTerminales(celdas, n, zonaBD = null) {
  // Sin saber cuántas terminales hay (fuente caída o aún sin cargar) no se toca nada: no es lo mismo que 0 terminales
  if (num(n) === null) return celdas;
  const total = Math.max(0, Math.floor(num(n)));
  const slots = celdas.filter(esTerminal);
  const otros = celdas.filter((c) => !esTerminal(c));
  if (!slots.length) {
    if (!total) return otros;
    // Sin tarjetas guardadas: debajo de los KPI (o arriba del todo) y lo que choque se corre hacia abajo
    const kpis = otros.filter((c) => c.codigo.includes('KPI'));
    const resto = otros.filter((c) => !c.codigo.includes('KPI'));
    const inicioY = kpis.length ? Math.max(...kpis.map((k) => k.y + k.rows)) : 0;
    const z = { ...zonaDe(zonaBD), x: 0, y: inicioY };
    const tarjetas = Array.from({ length: total }, (_, i) => ({ codigo: MOLDE_TERMINAL, idClon: `TERM_SLOT_${i}`, ...ranura(z, i), cols: z.cols, rows: z.rows, anclaje: 'DINAMICO', layoutId: null }));
    const fin = inicioY + altoZona(z, total);
    const minResto = resto.length ? Math.min(...resto.map((c) => c.y)) : fin;
    const corrimiento = minResto < fin ? fin - minResto : 0;
    return [...kpis, ...tarjetas, ...resto.map((c) => ({ ...c, y: c.y + corrimiento }))];
  }
  // Con tarjetas guardadas: su zona manda (posición de la primera, tamaño de la tarjeta)
  const indice = (s) => { const m = PATRON_SLOT.exec(s.idClon || ''); return m ? Number(m[1]) : null; };
  const y0 = Math.min(...slots.map((s) => s.y));
  const z = { ...zonaDe(zonaBD), x: Math.min(...slots.map((s) => s.x)), y: y0, cols: slots[0].cols, rows: slots[0].rows };
  if (!num(zonaBD?.maxItemsPorFila)) z.porFila = Math.max(1, Math.floor(COLUMNAS / z.cols));
  const finAnterior = Math.max(...slots.map((s) => s.y + s.rows));
  const tarjetas = Array.from({ length: total }, (_, i) => {
    const guardada = slots.find((s) => indice(s) === i);
    return guardada
      ? { ...guardada, idClon: `TERM_SLOT_${i}` }
      : { codigo: MOLDE_TERMINAL, idClon: `TERM_SLOT_${i}`, ...ranura(z, i), cols: z.cols, rows: z.rows, anclaje: 'DINAMICO', layoutId: null };
  });
  const finNuevo = tarjetas.length ? Math.max(...tarjetas.map((s) => s.y + s.rows)) : y0;
  const corrimiento = finNuevo - finAnterior;
  return [...tarjetas, ...otros.map((c) => (corrimiento && c.y >= finAnterior ? { ...c, y: Math.max(0, c.y + corrimiento) } : c))];
}

const ordenLectura = (a, b) => a.y - b.y || a.x - b.x;

const chocan = (a, b) => a.x < b.x + b.cols && b.x < a.x + a.cols && a.y < b.y + b.rows && b.y < a.y + a.rows;

/**
 * Celdas que se pisan (pasa en plantillas de la BD): como gridster2 al dibujar (autoposición), en orden de lectura,
 * la que choca con una ya puesta va al primer hueco donde cabe, de arriba abajo y de izquierda a derecha.
 * Así la web y la app quedan iguales y gridster ya no tiene nada que mover.
 */
function acomodar(celdas) {
  const puestas = [];
  for (const c of [...celdas].sort(ordenLectura)) {
    let lugar = c;
    if (puestas.some((p) => chocan(p, c))) {
      const cols = Math.min(COLUMNAS, c.cols);
      buscar: for (let y = 0; ; y++) {
        for (let x = 0; x + cols <= COLUMNAS; x++) {
          const prueba = { ...c, x, y, cols };
          if (!puestas.some((p) => chocan(p, prueba))) { lugar = prueba; break buscar; }
        }
      }
    }
    puestas.push(lugar);
  }
  return puestas;
}
const limpiar = ({ anclaje, layoutId, ...c }) => c;

/** @param {{ usuario?: Array, plantilla?: object|null, estados?: object, terminales?: number|null }} p  terminales null = no se sabe */
function layoutEfectivo({ usuario = [], plantilla = null, estados = {}, terminales = null } = {}) {
  const propias = sinDuplicados((Array.isArray(usuario) ? usuario : []).map(celda).filter(Boolean));
  let origen;
  let celdas;
  const zonaBD = plantilla?.zonaDinamica || plantilla?.configuracion?.zonaDinamica || null;
  if (propias.length) {
    origen = 'usuario';
    celdas = propias;
  } else {
    const estaticos = plantilla?.widgetsEstaticos || plantilla?.configuracion?.widgetsEstaticos || [];
    const widgets = sinDuplicados(estaticos
      .filter((w) => verdadero(w.inicial))
      .map(celda).filter(Boolean)
      .filter((c) => activo(estados[c.codigo])));
    if (!widgets.length) return { origen: 'sin_layout', celdas: [] };
    origen = 'defecto';
    const cascada = String(plantilla?.estrategia || '').toUpperCase() === ESTRATEGIA_CASCADA;
    celdas = cascada ? plantillaCascada(widgets, zonaBD, Math.max(0, Math.floor(num(terminales) ?? 0))) : plantillaEstatica(widgets);
  }
  // Terminales del puerto: solo donde la pestaña las maneja (zona dinámica en la BD o tarjetas guardadas)
  if (zonaBD || celdas.some(esTerminal)) celdas = ajustarTerminales(celdas, terminales, zonaBD);
  return { origen, celdas: acomodar(sinDuplicados(celdas)).sort(ordenLectura).map(limpiar) };
}

module.exports = { COLUMNAS, MOLDE_TERMINAL, celda, sinDuplicados, zonaDe, ajustarTerminales, acomodar, layoutEfectivo };
