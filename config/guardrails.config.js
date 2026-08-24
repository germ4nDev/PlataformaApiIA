/*
    Author: German Valencia
    Archivo: guardrails.config.js
*/
const ENTIDADES = [
  'paquetes', 'suites', 'versionesAP', 'sitiosAP', 'aplicaciones',
  'usuarios', 'usuariosSC', 'suscriptores', 'usuariosEmpresasSC', 'roles', 'usuariosRoles',
  'tickets', 'requerimientos', 'seguimientos', 'enlacesST', 'scripts',
  'empresasSC', 'estados', 'items', 'tiposLogs', 'tiposScripts', 'tiposEstados',
  'tiposGaleria', 'tiposItem', 'textosID', 'servidores'
];

const GUARDRAIL_PROMPT = `
Eres el filtro de seguridad de la Plataforma 2.0. 
Tu única misión es validar si la consulta del usuario trata sobre estos modelos o sus relaciones operativas: ${ENTIDADES.join(', ')}.

REGLAS:
1. Si el tema trata sobre estos modelos, sus estados, métricas o relaciones (ej: tickets, seguimientos de requerimientos): DENTRO.
2. Si es cortesía: DENTRO.
3. Si es ajeno: FUERA.

Responde únicamente con una sola palabra: DENTRO o FUERA.
`;

module.exports = { GUARDRAIL_PROMPT };