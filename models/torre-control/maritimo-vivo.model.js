/*
    Author: German Valencia
    Pattern: PORTTOS DTO Pattern - KPIs marítimos en vivo (estado AIS)
    Description: Esquemas Joi de las consultas de /api/maritimo/:puerto/{resumen,tiempos,ocupacion,llegadas}.
*/
const Joi = require('joi');

const PuertoParamSchema = Joi.object({
  puerto: Joi.string().trim().min(2).max(60).pattern(/^[\p{L}0-9 _-]+$/u).required()
    .messages({ 'string.pattern.base': 'El puerto solo admite letras, números, espacio, _ o -' }),
});

const vigenciaMin = Joi.number().integer().min(5).max(1440).default(60);

const ResumenQuerySchema = Joi.object({
  vigenciaMin,
  limiteCola: Joi.number().integer().min(1).max(100).default(20),
});

const TiemposQuerySchema = Joi.object({
  dias: Joi.number().integer().min(1).max(90).default(30),
});

const OcupacionQuerySchema = Joi.object({ vigenciaMin });

const LlegadasQuerySchema = Joi.object({
  horas: Joi.number().integer().min(1).max(240).default(72),
  horasAtras: Joi.number().integer().min(0).max(72).default(12),
  limite: Joi.number().integer().min(1).max(500).default(200),
});

module.exports = { PuertoParamSchema, ResumenQuerySchema, TiemposQuerySchema, OcupacionQuerySchema, LlegadasQuerySchema };
