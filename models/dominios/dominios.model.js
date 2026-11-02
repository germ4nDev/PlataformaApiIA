/*
    Author: German Valencia
    Pattern: PLATAFORMA Model (Joi) - Dominios de la plataforma (OT-012, migración 026)
*/
const Joi = require('joi');

// ?host=porttos.co (la web manda window.location.hostname). Sin host, el servicio usa el Origin de la petición.
const ContextoQuerySchema = Joi.object({
  host: Joi.string().trim().max(300).allow('', null),
}).unknown(true);

module.exports = { ContextoQuerySchema };
