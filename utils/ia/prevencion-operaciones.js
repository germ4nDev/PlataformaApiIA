/*
    Author: German Valencia
    Pattern: PORTTOS Core puro (AD-16) - Analista de prevención de operaciones de Granel y RoRo (capa de IA, CC-296)
    Description: Sin base de datos ni red. Como el de muelles, gate y patios: el modelo NO calcula; recibe las acciones que ya calculó
      apps/porttos/utils/pronostico-operaciones (reforzar el ritmo, correr el siguiente atraque) con su efecto en el fin de la operación,
      el retraso contra el plan y el choque con el atraque, y solo explica por qué, en qué orden y qué cuidar. Toda cifra que escriba debe
      estar en el contexto (verificarRecomendacion de muelles, con la automática de operaciones).
*/
const { HERRAMIENTA_PREVENCION, numerosEn } = require('./prevencion');

const HORA = 3600000;
/** Hora de Colombia «HH:MM» de una fecha ISO. */
const horaCol = (iso) => {
  if (!iso) return null;
  const d = new Date(Date.parse(iso) - 5 * HORA);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
};
const unidadTexto = (u) => (String(u || '').toUpperCase() === 'UNIDADES' ? 'unidades' : 't');
const horas = (min) => (min === null || min === undefined ? null : Math.round((min / 60) * 10) / 10);
const conComa = (n) => String(n).replace('.', ',');

/** Frase corta de una acción, con las cifras del núcleo (horas de Colombia). */
function textoAccionOperacion(a, unidad = 'TM') {
  if (a.tipo === 'REFORZAR_RITMO') return `Subir el ritmo en ${a.unidadesHora} ${unidadTexto(unidad)} por hora hasta terminar (más equipos o cuadrillas)`;
  if (a.tipo === 'CORRER_ATRAQUE') return `Correr el atraque de ${a.motonaveAtraque || 'la siguiente nave'} a las ${horaCol(a.nuevaHora)}`;
  return String(a.tipo);
}

/**
 * @param {{ puerto, operacion: { operacion, motonave, unidad, segmento, fin, retrasoMin, choqueMin, siguienteAtraque, candidatas },
 *           pronostico?: object, simulado? }} p  pronostico = la fila de la operación en pronosticarOperaciones (ritmos, plan, avance)
 */
function armarContextoPrevencionOperacion({ puerto, operacion: o, pronostico: p = {}, simulado = false }) {
  const cifras = new Set([0]);
  const anotar = (...ns) => ns.forEach((n) => { if (Number.isFinite(n)) { cifras.add(n); cifras.add(Math.round(n)); } });
  const anotarHora = (iso) => { const h = horaCol(iso); if (h) anotar(...h.split(':').map(Number)); return h; };
  [o.motonave, o.siguienteAtraque?.motonave, o.siguienteAtraque?.muelle, p.producto].forEach((t) => anotar(...numerosEn(t)));
  anotar(p.pendiente, p.total, p.avancePct, p.ritmoBase, p.ritmoLento, p.ritmoNecesario, o.retrasoMin, horas(o.retrasoMin), o.choqueMin);
  const fin = anotarHora(o.fin);
  const plan = anotarHora(p.plan?.hora);
  const atraque = anotarHora(o.siguienteAtraque?.hora);
  const opciones = (o.candidatas || []).map((c, i) => {
    anotar(i + 1, c.acciones.length);
    c.acciones.forEach((a) => { anotar(a.unidadesHora); anotarHora(a.nuevaHora); });
    const efectos = Object.values(c.efecto).map((e) => {
      anotar(e.retrasoMinAntes, e.retrasoMinDespues, horas(e.retrasoMinAntes), horas(e.retrasoMinDespues), e.choqueMinAntes, e.choqueMinDespues,
        e.atraqueCorridoMin, horas(e.atraqueCorridoMin), e.ritmoAntes, e.ritmoDespues);
      return { finAntes: anotarHora(e.finAntes), finDespues: anotarHora(e.finDespues), retrasoHorasAntes: horas(e.retrasoMinAntes),
        retrasoHorasDespues: horas(e.retrasoMinDespues), choqueMinAntes: e.choqueMinAntes, choqueMinDespues: e.choqueMinDespues,
        atraqueCorridoMin: e.atraqueCorridoMin, ritmoAntes: e.ritmoAntes ?? null, ritmoDespues: e.ritmoDespues ?? null, nivelDespues: e.nivelDespues };
    });
    return { id: `accion.${i + 1}`, ordenPorCosto: i + 1, acciones: c.acciones.map((a) => ({ ...a, texto: textoAccionOperacion(a, o.unidad) })), efectos };
  });
  return {
    puerto, simulado: !!simulado,
    terminal: {
      idTerminal: o.operacion, nombre: o.motonave || `Operación ${o.operacion}`, segmento: o.segmento, producto: p.producto || null,
      unidad: unidadTexto(o.unidad), pendiente: p.pendiente ?? null, avancePct: p.avancePct ?? null, ritmoBase: p.ritmoBase ?? null,
      ritmoLento: p.ritmoLento ?? null, ritmoNecesario: p.ritmoNecesario ?? null, plan, fin, retrasoHoras: horas(o.retrasoMin), choqueMin: o.choqueMin ?? null,
      siguienteAtraque: o.siguienteAtraque ? { motonave: o.siguienteAtraque.motonave, muelle: o.siguienteAtraque.muelle, hora: atraque } : null,
    },
    opciones, cifras, indice: new Set(opciones.map((x) => x.id)),
  };
}

const SISTEMA_PREVENCION_OPERACION_V1 = `Eres el analista de prevención de Porttos, la torre de control logística del puerto de {PUERTO}.
El pronóstico de Porttos dice que la operación de {TERMINAL} (descargue o cargue de granel, o de vehículos RoRo) terminaría después de su
plan o invadiría el atraque de la siguiente nave en el mismo muelle. Porttos ya calculó unas acciones que lo evitarían (subir el ritmo
con más equipos o cuadrillas, o correr el atraque siguiente) y el efecto de cada una en la hora de fin, el retraso y el choque.

Tu trabajo es explicar, no calcular:
- En «resumen», una o dos frases para el jefe de turno: qué pasará si no se hace nada y qué opción recomiendas.
- En «orden», las opciones de la más a la menos recomendable, con su id (accion.N) y un «porque» corto: qué se gana y qué costo
  operativo implica (subir el ritmo exige equipos, cuadrillas y camiones o bandas disponibles; correr un atraque afecta a otra naviera,
  a su espera en fondeo y al line-up).
- En «advertencias», lo que hay que confirmar antes de decidir o los límites del pronóstico (repite el ritmo de las últimas horas; una
  lluvia, una avería o un cambio de bodega lo cambian). Si los datos vienen marcados como simulados, dilo.

Reglas: usa SOLO cifras que aparezcan en los datos; no inventes horas, toneladas ni nombres. No digas que Porttos moverá equipos ni el
line-up: la decisión y la coordinación son de las personas. Español claro, sin tecnicismos. Responde con emitir_recomendacion.`;

const PROMPT_PREVENCION_OPERACION = Object.freeze({
  codigoTarea: 'prevencion', version: 1, idPrompt: null, origen: 'incorporado',
  temperatura: 0.2, maxTokens: 1200, sistema: SISTEMA_PREVENCION_OPERACION_V1, herramienta: HERRAMIENTA_PREVENCION,
});

function recomendacionAutomaticaOperacion(contexto) {
  const { terminal: t, opciones, simulado } = contexto;
  const partes = [`${t.nombre} terminaría hacia las ${t.fin}`];
  if (t.retrasoHoras > 0 && t.plan) partes.push(`${conComa(t.retrasoHoras)} h después del plan (${t.plan})`);
  if (t.choqueMin > 0 && t.siguienteAtraque) partes.push(`invadiendo ${t.choqueMin} min el atraque de ${t.siguienteAtraque.motonave}`);
  const situacion = partes.join(', ');
  if (!opciones.length) return { resumen: `${situacion}. Porttos no encontró una acción sencilla que lo resuelva.`, orden: [], advertencias: [] };
  const resumen = `${situacion}. La opción más sencilla: ${opciones[0].acciones.map((a) => a.texto).join('; ')}.`;
  const orden = opciones.map((o) => {
    const e = o.efectos[0];
    const frases = [`Termina hacia las ${e.finDespues}${e.retrasoHorasDespues > 0 ? `, ${conComa(e.retrasoHorasDespues)} h después del plan` : ', dentro del plan'}.`];
    if (e.atraqueCorridoMin > 0) frases.push(`La siguiente nave atraca ${e.atraqueCorridoMin} min más tarde.`);
    if (e.ritmoDespues) frases.push(`Pide ${e.ritmoDespues} ${t.unidad} por hora (hoy ${e.ritmoAntes}).`);
    return { id: o.id, porque: frases.join(' ') };
  });
  const advertencias = ['Confirmar con el operador portuario antes de decidir: Porttos no mueve equipos ni cambia el line-up.'];
  if (simulado) advertencias.push('Hay datos simulados en este pronóstico.');
  return { resumen, orden, advertencias };
}

function armarSolicitudPrevencionOperacion(contexto, prompt = PROMPT_PREVENCION_OPERACION) {
  const { cifras, indice, ...hechos } = contexto;
  return {
    sistema: [{ texto: prompt.sistema.replace(/\{PUERTO\}/g, contexto.puerto).replace(/\{TERMINAL\}/g, contexto.terminal.nombre), cache: false }],
    mensajes: [{ role: 'user', content: `Pronóstico del fin de la operación y acciones calculadas por Porttos:\n\n${JSON.stringify(hechos)}\n\nResponde con emitir_recomendacion.` }],
    herramienta: prompt.herramienta || HERRAMIENTA_PREVENCION,
  };
}

module.exports = { PROMPT_PREVENCION_OPERACION, armarContextoPrevencionOperacion, armarSolicitudPrevencionOperacion, recomendacionAutomaticaOperacion, textoAccionOperacion };
