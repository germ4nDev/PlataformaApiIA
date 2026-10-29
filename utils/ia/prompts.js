/*
    Author: German Valencia
    Pattern: PORTTOS Core puro (AD-16) - Prompts versionados de la capa de IA
    Description: Convierte una fila ACTIVA de TCL_IAPrompts en el prompt que usa una tarea, o devuelve el incorporado.
      El esquema de salida guardado puede ser la herramienta completa ({ name, input_schema }) o solo el JSON Schema.
      Lo usan el analista, los resúmenes, el asistente, el filtro de alcance y el panel de administración (para mostrar el incorporado).
*/
const { PROMPT_ANALISTA } = require('./analista');
const { PROMPT_RESUMEN } = require('./resumen');
const { PROMPT_ASISTENTE } = require('./asistente');
const { PROMPT_FILTRO } = require('./alcance');

/** Prompts incorporados por tarea (versión del código). */
const INCORPORADOS = Object.freeze({ analista_turno: PROMPT_ANALISTA, resumen_turno: PROMPT_RESUMEN, asistente: PROMPT_ASISTENTE, filtro: PROMPT_FILTRO });

/** @returns {object} prompt listo para el Cerebro: { codigoTarea, version, idPrompt, origen, modelo?, temperatura, maxTokens, sistema, herramienta } */
function desdeFila(fila, incorporado) {
  if (!fila) return incorporado;
  let herramienta = incorporado.herramienta;
  try {
    const esquema = JSON.parse(fila.esquemaSalida);
    herramienta = esquema?.name ? esquema : { ...incorporado.herramienta, input_schema: esquema };
  } catch { /* esquema ilegible: el incorporado */ }
  return {
    codigoTarea: fila.codigoTarea || incorporado.codigoTarea, version: fila.version, idPrompt: fila.id, origen: 'TCL_IAPrompts',
    modelo: fila.modelo, temperatura: Number(fila.temperatura), maxTokens: Number(fila.maxTokens), sistema: fila.sistema, herramienta,
  };
}

/** ¿El texto es un esquema de salida válido? (JSON con input_schema o con type: 'object'). */
function esquemaValido(texto) {
  try {
    const e = JSON.parse(texto);
    const schema = e?.input_schema || e;
    return !!schema && schema.type === 'object' && typeof schema.properties === 'object';
  } catch {
    return false;
  }
}

module.exports = { INCORPORADOS, desdeFila, esquemaValido };
