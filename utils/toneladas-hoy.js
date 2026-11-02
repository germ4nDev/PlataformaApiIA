/*
    Author: German Valencia
    Pattern: PORTTOS Núcleo puro (AD-16) - Toneladas movidas hoy por terminal y tipo (PTT_MAE_CHRT_TONELADAS, OT-009)
    Description: Sin base de datos ni red. Antes la gráfica tenía quemadas cinco terminales de un solo puerto y leía
      TCL_HistoricoProductividad (vacía): salía en cero en todos los puertos. Ahora suma el avance de hoy (hora de Colombia)
      de cada operación de buque (TCL_AvanceOperacionBuque) por la terminal de la operación y su tipo:
        - granel agrícola, mineral y líquido en toneladas; vehículos Ro-Ro en unidades (se dice en la etiqueta);
        - las terminales son las que tienen operación hoy en el puerto (nada fijo a un puerto);
        - si alguna operación es simulada, el origen lo dice.
      Contenedores y carga suelta no tienen avance horario todavía: no se dibujan (no se inventa un cero).
*/
const C = require('./tablero-comun');
const { origen } = require('./origen-dato');

const SERIES = Object.freeze([
  ['GRANEL', 'AGRICOLA', 'Granel agrícola (t)', '#10b981'],
  ['GRANEL', 'MINERAL', 'Granel mineral (t)', '#a87b51'],
  ['GRANEL', 'LIQUIDO', 'Granel líquido (t)', '#14b8a6'],
  ['RORO', null, 'Vehículos (unidades)', '#ec4899'],
]);

/**
 * @param {{ operaciones: object[], avance: object[] }} datos  operaciones de GRANEL y RORO con su avance horario
 */
function armarToneladasHoy({ operaciones = [], avance = [] }, ahora = new Date()) {
  const desde = C.inicioDiaColombia(ahora.getTime());
  const porId = new Map(operaciones.map((o) => [String(o.id_operacion), o]));
  const suma = new Map();                                   // terminal|serie → cantidad
  const terminales = new Set();
  let simulado = false;
  for (const a of avance) {
    if (Date.parse(a.hora) < desde) continue;
    const op = porId.get(String(a.id_operacion));
    if (!op) continue;
    const serie = SERIES.findIndex(([seg, tipo]) => seg === op.segmento && (tipo === null || tipo === String(op.tipo || '').toUpperCase()));
    if (serie < 0) continue;
    const terminal = op.terminal || 'Sin terminal';
    terminales.add(terminal);
    suma.set(`${terminal}|${serie}`, (suma.get(`${terminal}|${serie}`) || 0) + (C.num(a.cantidad) || 0));
    simulado = simulado || op.simulado === 1 || op.simulado === true;
  }
  const labels = [...terminales].sort();
  const datasets = SERIES.map(([, , label, color], i) => ({
    label, backgroundColor: color, data: labels.map((t) => Math.round((suma.get(`${t}|${i}`) || 0) * 10) / 10),
  })).filter((d) => d.data.some((v) => v > 0));
  return {
    titulo: '📊 TONELADAS MOVIDAS HOY · POR TIPO',
    labels, datasets,
    origen: origen({
      fuente: 'TCL_AvanceOperacionBuque', simulado, periodo: 'Hoy (hora de Colombia)',
      nota: [labels.length ? null : 'Sin operaciones de granel ni Ro-Ro con avance hoy', 'Contenedores y carga suelta sin avance horario'],
    }, ahora),
  };
}

module.exports = { SERIES, armarToneladasHoy };
