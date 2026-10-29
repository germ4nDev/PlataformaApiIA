/*
    Author: German Valencia
    Pattern: PORTTOS Model (Joi) - Tablero móvil (app móvil, fase 2)
*/
const Joi = require('joi');

const TableroMovilParamsSchema = Joi.object({
  puerto: Joi.string().trim().uppercase().max(40).pattern(/^[A-ZÁÉÍÓÚÑ0-9 _-]+$/).required(),
  pestana: Joi.string().trim().uppercase().max(60).pattern(/^[A-Z0-9_]+$/).required(),
});

const TableroMovilQuerySchema = Joi.object({
  fresco: Joi.boolean().truthy('1').falsy('0').default(false),
});

module.exports = { TableroMovilParamsSchema, TableroMovilQuerySchema };
