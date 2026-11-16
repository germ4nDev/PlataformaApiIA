/*
    Author: German Valencia
    Pattern: PLATAFORMA Model (Joi) - Dominios de la plataforma (OT-012, migración 026)
*/
const Joi = require('joi');

// ?host=porttos.co (la web manda window.location.hostname). Sin host, el servicio usa el Origin de la petición.
const ContextoQuerySchema = Joi.object({
  host: Joi.string().trim().max(300).allow('', null),
}).unknown(true);

// Aplicaciones › gestión (CC-202): dominios de una aplicación. Llegan como arreglo o como texto separado por comas.
const AplicacionParamsSchema = Joi.object({
  codigoAplicacion: Joi.string().trim().max(200).required(),
});
const DominiosAplicacionSchema = Joi.object({
  dominios: Joi.alternatives(Joi.array().items(Joi.string().trim().max(300).allow('')).max(20), Joi.string().trim().max(2000).allow('')).required(),
}).unknown(true);

module.exports = { ContextoQuerySchema, AplicacionParamsSchema, DominiosAplicacionSchema };
