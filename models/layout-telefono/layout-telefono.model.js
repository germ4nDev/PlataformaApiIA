/*
    Author: German Valencia
    Pattern: PORTTOS Model (Joi) - Layout del teléfono (OT-017 fase 2)
*/
const Joi = require('joi');

const LayoutTelefonoParamsSchema = Joi.object({
  pestana: Joi.string().trim().uppercase().max(200).pattern(/^[A-Z0-9_-]+$/).required(),
});

const ItemLayoutTelefonoSchema = Joi.object({
  codigo: Joi.string().trim().uppercase().max(200).pattern(/^[A-Z0-9_-]+$/).required(),
  x: Joi.number().integer().min(0).max(3).required(),
  y: Joi.number().integer().min(0).max(400).required(),
  cols: Joi.number().integer().min(1).max(4).required(),
  rows: Joi.number().integer().min(1).max(8).required(),
});

const LayoutTelefonoBodySchema = Joi.object({
  items: Joi.array().items(ItemLayoutTelefonoSchema).max(60).required(),
});

module.exports = { LayoutTelefonoParamsSchema, LayoutTelefonoBodySchema };
