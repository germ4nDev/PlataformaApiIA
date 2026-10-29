/*
    Author: German Valencia
    Pattern: PORTTOS Model (Joi) - Dispositivos de la app móvil y notificaciones push (fase 3)
*/
const Joi = require('joi');

const RegistroDispositivoSchema = Joi.object({
  token: Joi.string().trim().min(20).max(400).pattern(/^[A-Za-z0-9:_\-.]+$/).required(),
  plataforma: Joi.string().valid('android', 'ios').required(),
  puertos: Joi.alternatives(Joi.array().max(30).items(Joi.string().trim().max(40)), Joi.string().trim().max(400)).default('TODOS'),
  severidadMinima: Joi.string().valid('critica', 'atencion').default('critica'),
  idioma: Joi.string().valid('es', 'en').default('es'),
});

const BajaDispositivoSchema = Joi.object({
  token: Joi.string().trim().min(20).max(400).pattern(/^[A-Za-z0-9:_\-.]+$/).required(),
});

module.exports = { RegistroDispositivoSchema, BajaDispositivoSchema };
