/*
    Author: German Valencia
    Pattern: PLATAFORMA Model (Joi) - Aplicaciones con licencia de un suscriptor (OT-026)
*/
const Joi = require('joi');

const AplicacionesSuscriptorParamsSchema = Joi.object({
  codigoSuscriptor: Joi.string().trim().max(200).required(),
}).unknown(true);

module.exports = { AplicacionesSuscriptorParamsSchema };
