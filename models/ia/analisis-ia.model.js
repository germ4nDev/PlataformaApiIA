/*
    Author: German Valencia
    Pattern: PORTTOS DTO Pattern - Capa de análisis con IA (validación de entrada)
*/
const Joi = require('joi');
const { CATALOGO_KPI } = require('../../utils/ia/catalogo-kpi');
const { TIPOS_ALERTA, SEVERIDADES } = require('../../utils/ia/analista');
const { CODIGOS_VENTANA } = require('../../utils/ia/tendencias');
const { CODIGOS_TAREA } = require('../../utils/ia/config-efectiva');
const { esquemaValido } = require('../../utils/ia/prompts');

const PuertoParamsSchema = Joi.object({
  puerto: Joi.string().trim().uppercase().max(40).pattern(/^[A-ZÁÉÍÓÚÑ0-9 _-]+$/).required(),
});

const SerieKpiQuerySchema = Joi.object({
  kpi: Joi.string().valid(...CATALOGO_KPI.map((d) => d.codigo)).required(),
  horas: Joi.number().integer().min(1).max(168).default(24),
});

const HallazgosQuerySchema = Joi.object({
  estado: Joi.string().valid('PROPUESTO', 'PUBLICADO', 'CONFIRMADO', 'DESCARTADO', 'FALSO').optional(),
  dias: Joi.number().integer().min(1).max(90).default(7),
  limite: Joi.number().integer().min(1).max(500).default(100),
});

const UsoQuerySchema = Joi.object({ dias: Joi.number().integer().min(1).max(90).default(14) });

/** Fase 3: «útil / no era» sobre un hallazgo del analista. */
const HallazgoParamsSchema = Joi.object({ id: Joi.number().integer().min(1).required() });
const FeedbackSchema = Joi.object({
  util: Joi.boolean().required(),
  comentario: Joi.string().trim().max(500).allow('', null).optional(),
});

/** Fase 4: tendencias, resúmenes y administración. */
const TendenciasQuerySchema = Joi.object({
  ventana: Joi.string().valid(...CODIGOS_VENTANA).optional(),
  modulo: Joi.string().trim().lowercase().max(200).pattern(/^[a-z,]+$/).optional(),
  relevantes: Joi.boolean().truthy('1').falsy('0').default(false),
});
const ResumenesQuerySchema = Joi.object({
  tipo: Joi.string().valid('cierre_turno', 'resumen_diario').optional(),
  dias: Joi.number().integer().min(1).max(90).default(7),
  limite: Joi.number().integer().min(1).max(100).default(20),
});
const GenerarResumenSchema = Joi.object({ tipo: Joi.string().valid('cierre_turno', 'resumen_diario').default('cierre_turno') });
const AdminQuerySchema = Joi.object({ dias: Joi.number().integer().min(1).max(90).default(7) });
const puertoConfig = Joi.alternatives().try(Joi.string().valid('*'), Joi.string().trim().uppercase().max(40).pattern(/^[A-ZÁÉÍÓÚÑ0-9 _-]+$/));
/** Una fila de TCL_IAConfig desde el panel. null = hereda (del '*' o del .env). */
const ConfigIASchema = Joi.object({
  puerto: puertoConfig.required(),
  codigoTarea: Joi.string().valid(...CODIGOS_TAREA).required(),
  activo: Joi.boolean().allow(null).default(null),
  modoSombra: Joi.boolean().allow(null).default(null),
  topeLlamadasDia: Joi.number().integer().min(1).max(2000).allow(null).default(null),
  topeTokensDia: Joi.number().integer().min(10000).max(50000000).allow(null).default(null),
  confianzaMinima: Joi.number().min(0).max(1).precision(2).allow(null).default(null),
  tiposPublicar: Joi.array().items(Joi.string().valid('todos', ...TIPOS_ALERTA)).min(1).allow(null).default(null),
});
const PromptParamsSchema = Joi.object({ id: Joi.number().integer().min(1).required() });
const PromptsQuerySchema = Joi.object({ tarea: Joi.string().valid(...CODIGOS_TAREA).optional() });
const PromptSchema = Joi.object({
  codigoTarea: Joi.string().valid(...CODIGOS_TAREA).required(),
  modelo: Joi.string().trim().max(80).pattern(/^[a-z0-9.-]+$/).required(),
  temperatura: Joi.number().min(0).max(1).default(0.2),
  maxTokens: Joi.number().integer().min(200).max(8000).default(2000),
  sistema: Joi.string().trim().min(50).max(20000).required(),
  esquemaSalida: Joi.string().trim().max(50000).required()
    .custom((v, h) => (esquemaValido(v) ? v : h.message('esquemaSalida debe ser JSON con type "object" y properties (o una herramienta con input_schema)'))),
  nota: Joi.string().trim().max(400).allow('', null).optional(),
});
const EstadoPromptSchema = Joi.object({ estado: Joi.string().valid('ACTIVO', 'RETIRADO').required() });

/** Salida del resumen (herramienta emitir_resumen). */
const SalidaResumenSchema = Joi.object({
  titular: Joi.string().trim().min(5).max(140).required(),
  loQuePaso: Joi.array().max(5).items(Joi.string().trim().max(220)).required(),
  loQueViene: Joi.array().max(4).items(Joi.string().trim().max(220)).required(),
  vigilar: Joi.array().max(4).items(Joi.string().trim().max(200)).required(),
  tendencias: Joi.array().max(5).items(Joi.object({
    id: Joi.string().pattern(/^tendencia\..+$/).max(200).required(),
    explicacion: Joi.string().trim().min(5).max(260).required(),
  })).required(),
  evidencia: Joi.array().max(20).items(Joi.string().max(200)).required(),
});
function validarSalidaResumen(entrada) {
  const { error, value } = SalidaResumenSchema.validate(entrada, { abortEarly: false, stripUnknown: true, convert: true });
  return error ? { ok: false, valor: null, errores: error.details.map((d) => `${d.path.join('.')}: ${d.message}`) } : { ok: true, valor: value, errores: [] };
}

/** Fase 5: asistente y marco de alcance. */
const PreguntaSchema = Joi.object({
  pregunta: Joi.string().trim().min(2).max(1000).required(),
  puerto: Joi.string().trim().max(40).allow('', null).optional(),
  pestana: Joi.string().trim().max(60).allow('', null).optional(),
  historial: Joi.array().max(10).items(Joi.object({
    pregunta: Joi.string().trim().max(1000).required(),
    respuesta: Joi.string().trim().max(4000).allow('').required(),
  })).default([]),
});
const PreguntaParamsSchema = Joi.object({ id: Joi.number().integer().min(1).required() });
const FeedbackPreguntaSchema = Joi.object({ util: Joi.boolean().required(), comentario: Joi.string().trim().max(500).allow('', null).optional() });
const AdminAsistenteQuerySchema = Joi.object({
  dias: Joi.number().integer().min(1).max(90).default(7),
  decision: Joi.string().valid('dentro', 'frontera', 'fuera').optional(),
  limite: Joi.number().integer().min(1).max(500).default(100),
});
const TemaAlcanceSchema = Joi.object({
  codigo: Joi.string().trim().lowercase().max(40).pattern(/^[a-z0-9_]+$/).required(),
  nombre: Joi.string().trim().min(3).max(120).required(),
  ambito: Joi.string().valid('dentro', 'frontera', 'fuera').required(),
  descripcion: Joi.string().trim().min(10).max(600).required(),
  palabrasClave: Joi.array().max(200).items(Joi.string().trim().min(2).max(60)).default([]),
  ejemplos: Joi.array().max(10).items(Joi.string().trim().min(5).max(200)).default([]),
  activo: Joi.boolean().default(true),
  orden: Joi.number().integer().min(0).max(999).optional(),
});
const SalidaFiltroSchema = Joi.object({
  decision: Joi.string().valid('dentro', 'frontera', 'fuera').required(),
  tema: Joi.string().max(40).required(),
  confianza: Joi.number().min(0).max(1).required(),
  motivo: Joi.string().trim().max(150).allow('').required(),
});
const RespuestaAsistenteSchema = Joi.object({
  respuesta: Joi.string().trim().min(1).max(2500).required(),
  fuentes: Joi.array().max(8).items(Joi.object({ herramienta: Joi.string().max(60).required(), detalle: Joi.string().max(150).allow('').required() })).required(),
  sugerencias: Joi.array().max(3).items(Joi.string().trim().max(120)).required(),
  sinDatos: Joi.boolean().required(),
  fueraDeAlcance: Joi.boolean().required(),
});
const validarCon2 = (esquema) => (entrada) => {
  const { error, value } = esquema.validate(entrada, { abortEarly: false, stripUnknown: true, convert: true });
  return error ? { ok: false, valor: null, errores: error.details.map((d) => `${d.path.join('.')}: ${d.message}`) } : { ok: true, valor: value, errores: [] };
};
const validarSalidaFiltro = validarCon2(SalidaFiltroSchema);
const validarRespuestaAsistente = validarCon2(RespuestaAsistenteSchema);

/** Salida del analista de turno (herramienta emitir_analisis). Se valida antes de verificar la evidencia. */
const idEvidencia = Joi.string().pattern(/^(kpi|senal|alerta|evento)\..+$/).max(200);   // la existencia la revisa verificarEvidencia
const SalidaAnalistaSchema = Joi.object({
  alertas: Joi.array().max(6).items(Joi.object({
    tipo: Joi.string().valid(...TIPOS_ALERTA).required(),
    entidad: Joi.string().trim().min(1).max(120).required(),
    severidad: Joi.string().valid(...SEVERIDADES).required(),
    horizonteHoras: Joi.array().length(2).items(Joi.number().min(0).max(72)).required()
      .custom((v, h) => (v[0] <= v[1] ? v : h.error('any.invalid')), 'desde ≤ hasta'),
    confianza: Joi.number().min(0).max(1).required(),
    titulo: Joi.string().trim().min(5).max(90).required(),
    explicacion: Joi.string().trim().min(10).max(400).required(),
    accionSugerida: Joi.string().trim().min(3).max(200).required(),
    evidencia: Joi.array().min(1).max(8).items(idEvidencia).required(),
  })).required(),
  tendencias: Joi.array().max(5).items(Joi.object({
    metrica: Joi.string().pattern(/^kpi\./).max(120).required(),
    direccion: Joi.string().valid('sube', 'baja', 'estable').required(),
    lectura: Joi.string().trim().min(5).max(200).required(),
    evidencia: Joi.array().min(1).max(6).items(idEvidencia).required(),
  })).required(),
  resumenTurno: Joi.string().trim().max(600).allow('').required(),
  datosInsuficientes: Joi.array().max(8).items(Joi.string().max(120)).required(),
});

/** { ok, valor, errores } sin lanzar (el servicio decide si reintenta). */
function validarSalidaAnalista(entrada) {
  const { error, value } = SalidaAnalistaSchema.validate(entrada, { abortEarly: false, stripUnknown: true, convert: true });
  return error ? { ok: false, valor: null, errores: error.details.map((d) => `${d.path.join('.')}: ${d.message}`) } : { ok: true, valor: value, errores: [] };
}

module.exports = {
  PreguntaSchema, PreguntaParamsSchema, FeedbackPreguntaSchema, AdminAsistenteQuerySchema, TemaAlcanceSchema,
  SalidaFiltroSchema, RespuestaAsistenteSchema, validarSalidaFiltro, validarRespuestaAsistente,
  TendenciasQuerySchema, ResumenesQuerySchema, GenerarResumenSchema, AdminQuerySchema, ConfigIASchema, PromptParamsSchema,
  PromptsQuerySchema, PromptSchema, EstadoPromptSchema, SalidaResumenSchema, validarSalidaResumen,
  PuertoParamsSchema, SerieKpiQuerySchema, HallazgosQuerySchema, UsoQuerySchema, HallazgoParamsSchema, FeedbackSchema, SalidaAnalistaSchema, validarSalidaAnalista };
