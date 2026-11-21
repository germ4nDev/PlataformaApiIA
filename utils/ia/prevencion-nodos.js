/*
    Author: German Valencia
    Pattern: PORTTOS Core puro (AD-16) - Analista de prevención de patios y bodegas (capa de IA, CC-293)
    Description: Sin base de datos ni red. Como el de muelles y el del gate: el modelo NO calcula; recibe las acciones que ya calculó
      apps/porttos/utils/pronostico-nodos (adelantar retiros, reubicar) con su efecto en la ocupación, y solo explica por qué, en qué
      orden y qué cuidar. Toda cifra que escriba debe estar en el contexto (verificarRecomendacion de muelles, con la automática de nodos).
*/
const { HERRAMIENTA_PREVENCION, numerosEn } = require('./prevencion');

const HORA = 3600000;
const horaCol = (iso) => {
  const d = new Date(Date.parse(iso) - 5 * HORA);
  return `${String(d.getUTCHours()).padStart(2, '0')}:00`;
};
const unidadTexto = (u) => (String(u).toUpperCase() === 'TON' ? 't' : 'TEU');

/** Frase corta de una acción, con las cifras del núcleo (horas de Colombia). */
function textoAccionNodo(a, nombres = {}, unidad = 'TEU') {
  const u = unidadTexto(unidad);
  if (a.tipo === 'ADELANTAR_RETIROS') return `Retirar ${a.unidadesHora} ${u} más por hora de ${nombres[a.nodo] || a.nodo}, de las ${horaCol(a.desde)} a las ${horaCol(a.hasta)}`;
  if (a.tipo === 'REUBICAR') return `Pasar ${a.unidades} ${u} de ${nombres[a.nodo] || a.nodo} a ${nombres[a.aNodo] || a.aNodo}`;
  return String(a.tipo);
}

/** @param {{ puerto, nodo: { nodo, nombre, unidad, capacidad, cruceCritico, candidatas, nombres }, yaCritico?, pctHoy?, simulado? }} p */
function armarContextoPrevencionNodos({ puerto, nodo, pctHoy = null, yaCritico = false, simulado = false }) {
  const cifras = new Set([0]);
  const anotar = (...ns) => ns.forEach((n) => { if (Number.isFinite(n)) { cifras.add(n); cifras.add(Math.round(n)); } });
  const nombres = nodo.nombres || {};
  Object.values(nombres).forEach((t) => anotar(...numerosEn(t)));
  anotar(nodo.capacidad, pctHoy, nodo.cruceCritico?.enHoras, nodo.cruceCritico?.pct);
  if (nodo.cruceCritico?.hora) anotar(Number(horaCol(nodo.cruceCritico.hora).slice(0, 2)));
  const opciones = (nodo.candidatas || []).map((c, i) => {
    anotar(i + 1, c.acciones.length);
    c.acciones.forEach((a) => {
      anotar(a.unidadesHora, a.unidades, ...[a.desde, a.hasta].filter(Boolean).map((x) => Number(horaCol(x).slice(0, 2))));
    });
    const efectos = Object.entries(c.efecto).map(([id, e]) => {
      anotar(e.maxPctAntes, e.maxPctDespues, e.horasCriticasAntes, e.horasCriticasDespues, e.saleDeCriticoEnHoras, Math.round((e.maxPctAntes - e.maxPctDespues) * 10) / 10);
      return { nodo: nombres[id] || id, maxPctAntes: e.maxPctAntes, maxPctDespues: e.maxPctDespues, horasCriticasAntes: e.horasCriticasAntes,
        horasCriticasDespues: e.horasCriticasDespues, saleDeCriticoEnHoras: e.saleDeCriticoEnHoras };
    });
    return { id: `accion.${i + 1}`, ordenPorCosto: i + 1, acciones: c.acciones.map((a) => ({ ...a, texto: textoAccionNodo(a, nombres, nodo.unidad) })), efectos };
  });
  return {
    puerto, simulado: !!simulado,
    terminal: { idTerminal: nodo.nodo, nombre: nodo.nombre || nodo.nodo, unidad: unidadTexto(nodo.unidad), capacidad: nodo.capacidad, pctHoy, yaCritico: !!yaCritico,
      criticoEnHoras: nodo.cruceCritico?.enHoras ?? null, criticoHacia: nodo.cruceCritico?.hora ? horaCol(nodo.cruceCritico.hora) : null },
    opciones, cifras, indice: new Set(opciones.map((o) => o.id)),
  };
}

const SISTEMA_PREVENCION_NODOS_V1 = `Eres el analista de prevención de Porttos, la torre de control logística del puerto de {PUERTO}.
El pronóstico de Porttos dice que {TERMINAL} (un patio de contenedores, un depot de vacíos o una bodega) llegará a ocupación crítica,
o ya está en ella. Porttos ya calculó unas acciones que lo evitarían (retirar más carga por hora o pasar una parte a otro patio o
bodega del mismo tipo) y el efecto de cada una en la ocupación máxima y en las horas en crítico.

Tu trabajo es explicar, no calcular:
- En «resumen», una o dos frases para el jefe de turno: qué pasará si no se hace nada y qué opción recomiendas.
- En «orden», las opciones de la más a la menos recomendable, con su id (accion.N) y un «porque» corto: qué se gana y qué costo
  operativo implica (adelantar retiros exige citas de retiro y transporte disponibles; reubicar exige equipos de patio y que el
  destino sirva para esa carga: reefer, IMO, tipo de grano).
- En «advertencias», lo que hay que confirmar antes de decidir o los límites del pronóstico (repite el comportamiento de los últimos
  días). Si los datos vienen marcados como simulados, dilo.

Reglas: usa SOLO cifras que aparezcan en los datos; no inventes horas, porcentajes ni nombres. No digas que Porttos moverá la carga:
la decisión y la coordinación son de las personas. Español claro, sin tecnicismos. Responde con emitir_recomendacion.`;

const PROMPT_PREVENCION_NODOS = Object.freeze({
  codigoTarea: 'prevencion', version: 1, idPrompt: null, origen: 'incorporado',
  temperatura: 0.2, maxTokens: 1200, sistema: SISTEMA_PREVENCION_NODOS_V1, herramienta: HERRAMIENTA_PREVENCION,
});

function recomendacionAutomaticaNodos(contexto) {
  const { terminal: n, opciones, simulado } = contexto;
  const situacion = n.yaCritico ? `${n.nombre} ya está en ocupación crítica (${n.pctHoy} %)`
    : `${n.nombre} llegaría a ocupación crítica ${n.criticoHacia ? `hacia las ${n.criticoHacia}` : 'en el horizonte del pronóstico'}`;
  if (!opciones.length) return { resumen: `${situacion} y Porttos no encontró una acción sencilla que lo resuelva.`, orden: [], advertencias: [] };
  const resumen = `${situacion}. La opción más sencilla: ${opciones[0].acciones.map((a) => a.texto).join('; ')}.`;
  const orden = opciones.map((o) => {
    const propio = o.efectos.find((e) => e.nodo === n.nombre) || o.efectos[0];
    const otros = o.efectos.filter((e) => e !== propio);
    const partes = [`Deja la ocupación máxima en ${propio.maxPctDespues} % (antes ${propio.maxPctAntes} %).`];
    otros.forEach((e) => partes.push(`${e.nodo} queda en ${e.maxPctDespues} % (antes ${e.maxPctAntes} %).`));
    return { id: o.id, porque: partes.join(' ') };
  });
  const advertencias = ['Confirmar con el operador del patio o la bodega antes de decidir: Porttos no mueve la carga.'];
  if (simulado) advertencias.push('Hay datos simulados en este pronóstico.');
  return { resumen, orden, advertencias };
}

function armarSolicitudPrevencionNodos(contexto, prompt = PROMPT_PREVENCION_NODOS) {
  const { cifras, indice, ...hechos } = contexto;
  return {
    sistema: [{ texto: prompt.sistema.replace(/\{PUERTO\}/g, contexto.puerto).replace(/\{TERMINAL\}/g, contexto.terminal.nombre), cache: false }],
    mensajes: [{ role: 'user', content: `Pronóstico de ocupación y acciones calculadas por Porttos:\n\n${JSON.stringify(hechos)}\n\nResponde con emitir_recomendacion.` }],
    herramienta: prompt.herramienta || HERRAMIENTA_PREVENCION,
  };
}

module.exports = { PROMPT_PREVENCION_NODOS, armarContextoPrevencionNodos, armarSolicitudPrevencionNodos, recomendacionAutomaticaNodos, textoAccionNodo };
