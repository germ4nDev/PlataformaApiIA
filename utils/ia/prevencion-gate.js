/*
    Author: German Valencia
    Pattern: PORTTOS Core puro (AD-16) - Analista de prevención del gate (capa de IA, CC-290)
    Description: Sin base de datos ni red. Igual que el de muelles (utils/ia/prevencion.js), el modelo NO calcula: recibe las acciones
      que ya calculó apps/porttos/utils/pronostico-gate (reprogramar citas, reforzar capacidad) con su efecto en la espera, y solo
      explica por qué, en qué orden y qué cuidar. Toda cifra que escriba debe estar en el contexto (verificarRecomendacion de muelles,
      con la versión automática del gate).
      - armarContextoPrevencionGate({ puerto, terminal, simulado }), textoAccionGate(a), recomendacionAutomaticaGate(contexto)
      - PROMPT_PREVENCION_GATE (misma herramienta emitir_recomendacion y los mismos topes de la tarea «prevencion»).
*/
const { HERRAMIENTA_PREVENCION, numerosEn } = require('./prevencion');

const HORA = 3600000;
const horaCol = (iso) => {
  const d = new Date(Date.parse(iso) - 5 * HORA);
  return `${String(d.getUTCHours()).padStart(2, '0')}:00`;
};

/** Frase corta de una acción del gate, con las cifras del núcleo (horas de Colombia). */
function textoAccionGate(a) {
  if (a.tipo === 'REPROGRAMAR_CITAS') return `Pasar ${a.citas} citas de las ${horaCol(a.desde)} a partir de las ${horaCol(a.hacia)}`;
  if (a.tipo === 'REFORZAR_CAPACIDAD') return `Atender ${a.camionesHora} camiones más por hora de las ${horaCol(a.desde)} a las ${horaCol(a.hasta)}`;
  return String(a.tipo);
}

/**
 * @param {{ puerto:string, terminal:{ terminal, capacidadHora, cruceCritico, candidatas }, simulado?:boolean }} p
 */
function armarContextoPrevencionGate({ puerto, terminal, simulado = false }) {
  const cifras = new Set([0]);
  const anotar = (...ns) => ns.forEach((n) => { if (Number.isFinite(n)) { cifras.add(n); cifras.add(Math.round(n)); } });
  const horaNum = (iso) => Number(horaCol(iso).slice(0, 2));
  anotar(...numerosEn(terminal.terminal), terminal.capacidadHora, terminal.cruceCritico?.enHoras);
  if (terminal.cruceCritico?.desde) anotar(horaNum(terminal.cruceCritico.desde));
  const opciones = (terminal.candidatas || []).map((c, i) => {
    anotar(i + 1, c.acciones.length);
    c.acciones.forEach((a) => {
      anotar(a.citas, a.camionesHora, ...[a.desde, a.hacia, a.hasta].filter(Boolean).map(horaNum));
      if (a.camionesHora) anotar(terminal.capacidadHora + a.camionesHora);
    });
    const e = c.efecto;
    anotar(e.esperaMaxAntes, e.esperaMaxDespues, e.horasCriticasAntes, e.horasCriticasDespues, e.esperaMaxAntes - e.esperaMaxDespues);
    const totalCitas = c.acciones.reduce((t, a) => t + (a.citas || 0), 0);
    if (totalCitas) anotar(totalCitas);
    return {
      id: `accion.${i + 1}`, ordenPorCosto: i + 1, acciones: c.acciones.map((a) => ({ ...a, texto: textoAccionGate(a) })),
      efecto: { esperaMaxMinAntes: e.esperaMaxAntes, esperaMaxMinDespues: e.esperaMaxDespues, horasCriticasAntes: e.horasCriticasAntes,
        horasCriticasDespues: e.horasCriticasDespues, criticoEvitado: e.criticoEvitado },
    };
  });
  return {
    puerto, simulado: !!simulado,
    terminal: { idTerminal: terminal.terminal, nombre: terminal.terminal, capacidadCamionesHora: terminal.capacidadHora,
      criticoEnHoras: terminal.cruceCritico?.enHoras ?? null, criticoHacia: terminal.cruceCritico?.desde ? horaCol(terminal.cruceCritico.desde) : null },
    opciones, cifras, indice: new Set(opciones.map((o) => o.id)),
  };
}

const SISTEMA_PREVENCION_GATE_V1 = `Eres el analista de prevención de Porttos, la torre de control logística del puerto de {PUERTO}.
El pronóstico de Porttos dice que la espera de los camiones en el gate del terminal {TERMINAL} llegará a nivel crítico. Porttos ya
calculó unas acciones que lo evitarían (reprogramar citas a horas más libres o atender más camiones por hora) y el efecto de cada
una en la espera máxima y en las horas críticas.

Tu trabajo es explicar, no calcular:
- En «resumen», una o dos frases para el jefe de turno: qué pasará si no se hace nada y qué opción recomiendas.
- En «orden», las opciones de la más a la menos recomendable, con su id (accion.N) y un «porque» corto: qué se gana y qué costo
  operativo implica (reprogramar exige avisar a transportadores y conductores con tiempo; reforzar exige personal, carriles o
  equipos de inspección disponibles).
- En «advertencias», lo que hay que confirmar antes de decidir o los límites del pronóstico (la capacidad es la observada en las
  últimas 24 h). Si los datos vienen marcados como simulados, dilo.

Reglas: usa SOLO cifras que aparezcan en los datos; no inventes horas, minutos ni nombres. No digas que Porttos cambiará las
citas: la decisión y la coordinación son de las personas. Español claro, sin tecnicismos. Responde con emitir_recomendacion.`;

const PROMPT_PREVENCION_GATE = Object.freeze({
  codigoTarea: 'prevencion', version: 1, idPrompt: null, origen: 'incorporado',
  temperatura: 0.2, maxTokens: 1200, sistema: SISTEMA_PREVENCION_GATE_V1, herramienta: HERRAMIENTA_PREVENCION,
});

/** Sin modelo: el orden por costo del núcleo y frases armadas con sus cifras. */
function recomendacionAutomaticaGate(contexto) {
  const { terminal, opciones, simulado } = contexto;
  const cuando = terminal.criticoHacia === null ? 'en el horizonte del pronóstico'
    : terminal.criticoEnHoras === 0 ? 'ya en esta hora' : `hacia las ${terminal.criticoHacia}`;
  if (!opciones.length) {
    return { resumen: `La espera en el gate de ${terminal.nombre} llegaría a nivel crítico ${cuando} y Porttos no encontró una acción sencilla que lo evite.`, orden: [], advertencias: [] };
  }
  const resumen = `La espera en el gate de ${terminal.nombre} llegaría a nivel crítico ${cuando}. La opción más sencilla: ${opciones[0].acciones.map((a) => a.texto).join('; ')}.`;
  const orden = opciones.map((o) => ({
    id: o.id,
    porque: `Deja la espera máxima en ${o.efecto.esperaMaxMinDespues} min (antes ${o.efecto.esperaMaxMinAntes} min) y las horas críticas en ${o.efecto.horasCriticasDespues} (antes ${o.efecto.horasCriticasAntes}).`,
  }));
  const advertencias = ['Confirmar con el terminal y los transportadores antes de decidir: Porttos no cambia las citas.'];
  if (simulado) advertencias.push('Hay citas simuladas en este pronóstico.');
  return { resumen, orden, advertencias };
}

function armarSolicitudPrevencionGate(contexto, prompt = PROMPT_PREVENCION_GATE) {
  const { cifras, indice, ...hechos } = contexto;
  return {
    sistema: [{ texto: prompt.sistema.replace(/\{PUERTO\}/g, contexto.puerto).replace(/\{TERMINAL\}/g, contexto.terminal.nombre), cache: false }],
    mensajes: [{ role: 'user', content: `Pronóstico del gate y acciones calculadas por Porttos:\n\n${JSON.stringify(hechos)}\n\nResponde con emitir_recomendacion.` }],
    herramienta: prompt.herramienta || HERRAMIENTA_PREVENCION,
  };
}

module.exports = { PROMPT_PREVENCION_GATE, armarContextoPrevencionGate, armarSolicitudPrevencionGate, recomendacionAutomaticaGate, textoAccionGate };
