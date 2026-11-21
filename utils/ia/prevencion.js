/*
    Author: German Valencia
    Pattern: PORTTOS Core puro (AD-16) - Analista de prevención de muelles (capa de IA, CC-276)
    Description: Sin base de datos ni red. El modelo NO calcula: recibe las acciones candidatas que ya calculó el núcleo
      apps/porttos/utils/pronostico-muelles (CC-273) con su efecto, y solo explica en palabras por qué cada una tiene sentido,
      en qué orden conviene y qué cuidar. Regla de datos honestos: toda cifra que escriba debe estar en el contexto.
      - armarContextoPrevencion({ puerto, terminal, candidatas, simulado }): opciones accion.1..N con sus cifras, el conjunto de
        cifras permitidas y el índice de ids.
      - PROMPT_PREVENCION y armarSolicitudPrevencion(): herramienta emitir_recomendacion (salida forzada).
      - verificarRecomendacion(salida, contexto): quita ids inexistentes o repetidos y los textos con cifras que no están en el
        contexto; completa el orden con las opciones que el modelo no nombró. Dice qué quitó.
      - recomendacionAutomatica(contexto): el mismo formato sin modelo (IA apagada, sin presupuesto o error).
*/
const NOMBRE_ACCION = { MOVER_ATRAQUE: 'Retrasar el atraque', REASIGNAR_MUELLE: 'Pasar a otro muelle', ADELANTAR_ZARPE: 'Adelantar el zarpe' };

const horasDe = (min) => (min === null || min === undefined ? null : Math.round((min / 60) * 10) / 10);

/** Frase corta de una acción, con las cifras del núcleo. */
function textoAccion(a) {
  const nave = a.motonave ? ` de ${a.motonave}` : '';
  if (a.tipo === 'MOVER_ATRAQUE') return `Retrasar ${a.horas} h el atraque${nave} en ${a.muelle}`;
  if (a.tipo === 'ADELANTAR_ZARPE') return `Adelantar ${a.horas} h el zarpe${nave} en ${a.muelle}`;
  if (a.tipo === 'REASIGNAR_MUELLE') return `Pasar${nave} de ${a.muelle} a ${a.aMuelle}${a.aTerminal && a.aTerminal !== a.terminal ? ` (${a.aTerminal})` : ''}`;
  return `${NOMBRE_ACCION[a.tipo] || a.tipo} en ${a.muelle}`;
}

/**
 * @param {{ puerto:string, terminal:{ idTerminal, nombre, cruceCriticoMin }, candidatas:Array<{acciones, efecto}>, simulado?:boolean }} p
 * @returns {{ puerto, terminal, simulado, opciones:Array, cifras:Set<number>, indice:Set<string> }}
 */
function armarContextoPrevencion({ puerto, terminal, candidatas = [], simulado = false }) {
  const cifras = new Set();
  const anotar = (...ns) => ns.forEach((n) => { if (Number.isFinite(n)) { cifras.add(n); cifras.add(Math.round(n)); } });
  const cruceH = horasDe(terminal.cruceCriticoMin);
  anotar(...numerosEn(terminal.nombre));
  anotar(cruceH, terminal.cruceCriticoMin, Math.floor((terminal.cruceCriticoMin ?? NaN) / 60), Math.ceil((terminal.cruceCriticoMin ?? NaN) / 60));
  const opciones = candidatas.map((c, i) => {
    const id = `accion.${i + 1}`;
    anotar(i + 1, c.acciones.length);
    c.acciones.forEach((a) => { anotar(a.horas); [a.motonave, a.muelle, a.aMuelle].forEach((t) => anotar(...numerosEn(t))); });
    const propio = c.efecto.find((e) => e.idTerminal === terminal.idTerminal) || null;
    const otras = c.efecto.filter((e) => e.idTerminal !== terminal.idTerminal
      && (e.antes.maxPct !== e.despues.maxPct || e.antes.cruceCriticoMin !== e.despues.cruceCriticoMin));
    [propio, ...otras].filter(Boolean).forEach((e) => {
      anotar(e.antes.maxPct, e.despues.maxPct, horasDe(e.antes.cruceCriticoMin), horasDe(e.despues.cruceCriticoMin));
      if (Number.isFinite(e.antes.maxPct) && Number.isFinite(e.despues.maxPct)) anotar(Math.abs(e.antes.maxPct - e.despues.maxPct));
    });
    const efecto = (e) => ({
      terminal: e.nombre, maxPctAntes: e.antes.maxPct, maxPctDespues: e.despues.maxPct,
      criticoEnHorasAntes: horasDe(e.antes.cruceCriticoMin), criticoEnHorasDespues: horasDe(e.despues.cruceCriticoMin),
    });
    return {
      id, ordenPorCosto: i + 1, acciones: c.acciones.map((a) => ({ ...a, texto: textoAccion(a) })),
      efectoEnTerminal: propio ? efecto(propio) : null, otrasTerminalesQueCambian: otras.map(efecto),
    };
  });
  return {
    puerto, simulado: !!simulado,
    terminal: { idTerminal: terminal.idTerminal, nombre: terminal.nombre || terminal.idTerminal, criticoEnHoras: cruceH },
    opciones, cifras, indice: new Set(opciones.map((o) => o.id)),
  };
}

const SISTEMA_PREVENCION_V1 = `Eres el analista de prevención de Porttos, la torre de control logística del puerto de {PUERTO}.
El pronóstico de Porttos dice que el terminal {TERMINAL} llegará a ocupación crítica de muelles. Porttos ya calculó unas
acciones que lo evitarían y el efecto de cada una (ocupación máxima antes y después, en qué horas llegaría a crítico).

Tu trabajo es explicar, no calcular:
- En «resumen», una o dos frases para el jefe de turno: qué pasará si no se hace nada y qué opción recomiendas.
- En «orden», las opciones de la más a la menos recomendable, con su id (accion.N) y un «porque» corto: qué se gana,
  qué costo operativo implica (mover un atraque afecta a la nave que espera; adelantar un zarpe exige terminar antes la
  operación; reasignar exige que el otro muelle sirva para esa carga) y si traslada el problema a otro terminal.
- En «advertencias», lo que hay que confirmar antes de decidir (con la agencia, el terminal o el piloto) o los límites del
  pronóstico. Si los datos vienen marcados como simulados, dilo.

Reglas: usa SOLO cifras que aparezcan en los datos; no inventes horas, porcentajes ni nombres. No digas que Porttos cambiará
el line-up: la decisión y la coordinación son de las personas. Español claro, sin tecnicismos. Responde con emitir_recomendacion.`;

const HERRAMIENTA_PREVENCION = Object.freeze({
  name: 'emitir_recomendacion',
  description: 'Explicación y orden recomendado de las acciones de prevención que calculó Porttos.',
  input_schema: {
    type: 'object',
    properties: {
      resumen: { type: 'string', description: 'Una o dos frases para el jefe de turno (máx. 400 caracteres).' },
      orden: {
        type: 'array', description: 'Opciones de la más a la menos recomendable.',
        items: {
          type: 'object',
          properties: { id: { type: 'string', description: 'accion.N tal como viene en los datos' }, porque: { type: 'string', description: 'Máx. 300 caracteres.' } },
          required: ['id', 'porque'],
        },
      },
      advertencias: { type: 'array', items: { type: 'string' }, description: 'Hasta 3, máx. 200 caracteres cada una.' },
    },
    required: ['resumen', 'orden', 'advertencias'],
  },
});

const PROMPT_PREVENCION = Object.freeze({
  codigoTarea: 'prevencion', version: 1, idPrompt: null, origen: 'incorporado',
  temperatura: 0.2, maxTokens: 1200, sistema: SISTEMA_PREVENCION_V1, herramienta: HERRAMIENTA_PREVENCION,
});

/** Lo que va al modelo: sin el conjunto de cifras ni el índice. */
function hechosDe(contexto) {
  const { cifras, indice, ...hechos } = contexto;
  return hechos;
}

function armarSolicitudPrevencion(contexto, prompt = PROMPT_PREVENCION) {
  return {
    sistema: [{ texto: prompt.sistema.replace(/\{PUERTO\}/g, contexto.puerto).replace(/\{TERMINAL\}/g, contexto.terminal.nombre), cache: false }],
    mensajes: [{ role: 'user', content: `Pronóstico y acciones calculadas por Porttos:\n\n${JSON.stringify(hechosDe(contexto))}\n\nResponde con emitir_recomendacion.` }],
    herramienta: prompt.herramienta || HERRAMIENTA_PREVENCION,
  };
}

/** Números escritos en un texto (sin los que forman parte de un id accion.N ni de un nombre de muelle tipo CB-2). */
function numerosEn(texto) {
  const limpio = String(texto || '').replace(/accion\.\d+/gi, '').replace(/[A-Za-zÁÉÍÓÚÑáéíóúñ]+[-·]?\d+/g, '');
  return (limpio.match(/\d+(?:[.,]\d+)?/g) || []).map((n) => Number(n.replace(',', '.')));
}

/** ¿Todas las cifras del texto están en el contexto? */
const cifrasHonestas = (texto, contexto) => numerosEn(texto).every((n) => contexto.cifras.has(n) || contexto.cifras.has(Math.round(n)));

/** CC-290: `automatica` es la versión sin modelo del mismo contexto (muelles por defecto; el gate pasa la suya). */
function verificarRecomendacion(salida, contexto, automatica = recomendacionAutomatica) {
  const quitadas = [];
  const vistos = new Set();
  const orden = [];
  (salida.orden || []).forEach((o) => {
    if (!contexto.indice.has(o.id)) { quitadas.push(`id inexistente ${o.id}`); return; }
    if (vistos.has(o.id)) { quitadas.push(`id repetido ${o.id}`); return; }
    vistos.add(o.id);
    if (!cifrasHonestas(o.porque, contexto)) { quitadas.push(`cifra no verificable en ${o.id}`); orden.push({ id: o.id, porque: null }); return; }
    orden.push({ id: o.id, porque: o.porque });
  });
  contexto.opciones.filter((op) => !vistos.has(op.id)).forEach((op) => orden.push({ id: op.id, porque: null }));
  const advertencias = (salida.advertencias || []).filter((a) => {
    const ok = cifrasHonestas(a, contexto);
    if (!ok) quitadas.push('advertencia con cifra no verificable');
    return ok;
  });
  let resumen = salida.resumen;
  if (!cifrasHonestas(resumen, contexto)) { quitadas.push('resumen con cifra no verificable'); resumen = automatica(contexto).resumen; }
  return { salida: { resumen, orden, advertencias }, quitadas };
}

/** Sin modelo: el orden por costo del núcleo y frases armadas con sus cifras. */
function recomendacionAutomatica(contexto) {
  const { terminal, opciones, simulado } = contexto;
  const cuando = terminal.criticoEnHoras === null ? 'en el horizonte del pronóstico' : `en unas ${terminal.criticoEnHoras} h`;
  if (!opciones.length) {
    return { resumen: `${terminal.nombre} llegaría a ocupación crítica ${cuando} y Porttos no encontró una acción sencilla que lo evite.`, orden: [], advertencias: [] };
  }
  const primera = opciones[0];
  const resumen = `${terminal.nombre} llegaría a ocupación crítica ${cuando}. La opción más sencilla: ${primera.acciones.map((a) => a.texto).join(' y ')}.`;
  const orden = opciones.map((o) => {
    const e = o.efectoEnTerminal;
    const partes = [e ? `Deja la ocupación máxima en ${e.maxPctDespues} % (antes ${e.maxPctAntes} %).` : null];
    if (o.otrasTerminalesQueCambian.length) partes.push(`Cambia también ${o.otrasTerminalesQueCambian.map((t) => `${t.terminal} (${t.maxPctAntes} % → ${t.maxPctDespues} %)`).join(', ')}.`);
    return { id: o.id, porque: partes.filter(Boolean).join(' ') };
  });
  const advertencias = ['Confirmar con la agencia y el terminal antes de decidir: Porttos no cambia el line-up.'];
  if (simulado) advertencias.push('Hay datos simulados en el line-up de este pronóstico.');
  return { resumen, orden, advertencias };
}

module.exports = {
  PROMPT_PREVENCION, HERRAMIENTA_PREVENCION, armarContextoPrevencion, armarSolicitudPrevencion, verificarRecomendacion,
  recomendacionAutomatica, textoAccion, numerosEn, hechosDe,
};
