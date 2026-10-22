/*
    Author: German Valencia
    Pattern: PORTTOS DTO Pattern - Recorrido del mapa (modo reproducir)
    Description: Esquemas Joi de GET /api/recorrido-mapa/:puerto?horas=24.
*/
const Joi = require('joi');
const { PuertoParamSchema } = require('./maritimo-vivo.model');

const RecorridoQuerySchema = Joi.object({
  horas: Joi.number().integer().min(1).max(72).default(24),
});

module.exports = { PuertoParamSchema, RecorridoQuerySchema };
