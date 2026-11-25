/*
    Author: German Valencia
    Pattern: PORTTOS Core puro (AD-16) - Analista de prevención del inventario de GNL (capa de IA, CC-302)
    Description: Sin base de datos ni red. Como los demás analistas de prevención: el modelo NO calcula; recibe las acciones que ya
      calculó apps/porttos/utils/pronostico-gnl (adelantar o retrasar un metanero, reducir el envío a la red) con su efecto en el llenado
      de los tanques, y solo explica por qué, en qué orden y qué cuidar. Toda cifra que escriba debe estar en el contexto
      (verificarRecomendacion de muelles, con la automática de GNL).
*/
const { HERRAMIENTA_PREVENCION, numerosEn } = require('./prevencion');

const HORA = 3600000;
const diaHora = (iso) => {
  if (!iso) return null;
  const d = new Date(Date.parse(iso) - 5 * HORA);
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
};
const partes = (iso) => (iso ? diaHora(iso).split(/[/ :]/).map(Number) : []);

/** Frase corta de una acción, con las cifras del núcleo (horas de Colombia). */
function textoAccionGnl(a, motonaves = {}) {
  const nave = motonaves[a.operacion] || 'el siguiente metanero';
  if (a.tipo === 'ADELANTAR_LLEGADA') return `Traer ${a.horas} h antes a ${nave}`;
  if (a.tipo === 'RETRASAR_LLEGADA') return `Retrasar ${a.horas} h la descarga de ${nave}`;
  if (a.tipo === 'REDUCIR_ENVIO') return `Enviar ${a.m3h} m³/h menos a la red hasta el ${diaHora(a.hasta)}`;
  return String(a.tipo);
}

/** @param {{ puerto, acciones: { capacidadM3, critico, sinEspacio, motonaves, candidatas }, pctHoy?, simulado? }} p */
function armarContextoPrevencionGnl({ puerto, acciones: r, pctHoy = null, simulado = false }) {
  const cifras = new Set([0]);
  const anotar = (...ns) => ns.forEach((n) => { if (Number.isFinite(n)) { cifras.add(n); cifras.add(Math.round(n)); } });
  Object.values(r.motonaves || {}).forEach((t) => anotar(...numerosEn(t)));
  anotar(r.capacidadM3, pctHoy, r.critico?.enHoras, r.critico?.pct, r.sinEspacio?.enHoras, r.sinEspacio?.pct, ...partes(r.critico?.hora), ...partes(r.sinEspacio?.hora));
  const opciones = (r.candidatas || []).map((c, i) => {
    anotar(i + 1, c.acciones.length);
    c.acciones.forEach((a) => anotar(a.horas, a.m3h, ...partes(a.hasta)));
    const e = c.efecto || {};
    anotar(e.minPctAntes, e.minPctDespues, e.maxPctAntes, e.maxPctDespues, ...partes(e.criticoAntes), ...partes(e.criticoDespues));
    return { id: `accion.${i + 1}`, ordenPorCosto: i + 1, acciones: c.acciones.map((a) => ({ ...a, texto: textoAccionGnl(a, r.motonaves) })),
      efectos: [{ minPctAntes: e.minPctAntes, minPctDespues: e.minPctDespues, maxPctAntes: e.maxPctAntes, maxPctDespues: e.maxPctDespues,
        criticoDespues: diaHora(e.criticoDespues), sinEspacioDespues: !!e.sinEspacioDespues }] };
  });
  return {
    puerto, simulado: !!simulado,
    terminal: { idTerminal: puerto, nombre: `GNL de ${puerto}`, capacidadM3: r.capacidadM3, pctHoy,
      criticoHacia: diaHora(r.critico?.hora), criticoPct: r.critico?.pct ?? null, sinEspacioHacia: diaHora(r.sinEspacio?.hora) },
    opciones, cifras, indice: new Set(opciones.map((o) => o.id)),
  };
}

const SISTEMA_PREVENCION_GNL_V1 = `Eres el analista de prevención de Porttos, la torre de control logística del puerto de {PUERTO}.
El pronóstico de Porttos dice que el inventario de GNL de los tanques del puerto bajaría del mínimo operativo, o que la descarga de un
metanero no cabría en los tanques. Porttos ya calculó unas acciones que lo evitarían (traer antes o retrasar un metanero, enviar menos
gas a la red por unas horas) y su efecto en el llenado mínimo y máximo de los tanques.

Tu trabajo es explicar, no calcular:
- En «resumen», una o dos frases para el jefe de turno: qué pasará si no se hace nada y qué opción recomiendas.
- En «orden», las opciones de la más a la menos recomendable, con su id (accion.N) y un «porque» corto: qué se gana y qué costo implica
  (mover un metanero depende del naviero, del canal y de la marea; enviar menos gas afecta a los clientes de la red y a la generación
  térmica que dependa de él).
- En «advertencias», lo que hay que confirmar antes de decidir o los límites del pronóstico (repite el consumo de los últimos días; un
  despacho extraordinario o una parada de planta lo cambian). Si los datos vienen marcados como simulados, dilo.

Reglas: usa SOLO cifras que aparezcan en los datos; no inventes horas, porcentajes, volúmenes ni nombres. No digas que Porttos moverá
buques ni cambiará el envío: la decisión y la coordinación son de las personas. Español claro, sin tecnicismos. Responde con emitir_recomendacion.`;

const PROMPT_PREVENCION_GNL = Object.freeze({
  codigoTarea: 'prevencion', version: 1, idPrompt: null, origen: 'incorporado',
  temperatura: 0.2, maxTokens: 1200, sistema: SISTEMA_PREVENCION_GNL_V1, herramienta: HERRAMIENTA_PREVENCION,
});

function recomendacionAutomaticaGnl(contexto) {
  const { terminal: t, opciones, simulado } = contexto;
  const situacion = t.criticoHacia ? `El inventario de GNL bajaría del mínimo hacia el ${t.criticoHacia} (${t.criticoPct} %)`
    : t.sinEspacioHacia ? `La descarga del siguiente metanero no cabría en los tanques hacia el ${t.sinEspacioHacia}`
      : `El inventario de GNL está en ${t.pctHoy} %`;
  if (!opciones.length) return { resumen: `${situacion} y Porttos no encontró una acción sencilla que lo resuelva.`, orden: [], advertencias: [] };
  const resumen = `${situacion}. La opción más sencilla: ${opciones[0].acciones.map((a) => a.texto).join('; ')}.`;
  const orden = opciones.map((o) => {
    const e = o.efectos[0];
    return { id: o.id, porque: `El llenado no baja de ${e.minPctDespues} % (sin la acción, ${e.minPctAntes} %) ni pasa de ${e.maxPctDespues} %.` };
  });
  const advertencias = ['Confirmar con la terminal de GNL y el naviero antes de decidir: Porttos no mueve buques ni cambia el envío.'];
  if (simulado) advertencias.push('Hay datos simulados en este pronóstico.');
  return { resumen, orden, advertencias };
}

function armarSolicitudPrevencionGnl(contexto, prompt = PROMPT_PREVENCION_GNL) {
  const { cifras, indice, ...hechos } = contexto;
  return {
    sistema: [{ texto: prompt.sistema.replace(/\{PUERTO\}/g, contexto.puerto), cache: false }],
    mensajes: [{ role: 'user', content: `Pronóstico del inventario de GNL y acciones calculadas por Porttos:\n\n${JSON.stringify(hechos)}\n\nResponde con emitir_recomendacion.` }],
    herramienta: prompt.herramienta || HERRAMIENTA_PREVENCION,
  };
}

module.exports = { PROMPT_PREVENCION_GNL, armarContextoPrevencionGnl, armarSolicitudPrevencionGnl, recomendacionAutomaticaGnl, textoAccionGnl };
