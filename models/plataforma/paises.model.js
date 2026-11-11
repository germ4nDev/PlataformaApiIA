/*
    Author: German Valencia
    Pattern: PLATAFORMA Model (Joi) - Países (el formato fino lo revisa utils/plataforma/paises.js)
*/
const Joi = require('joi');

const PaisSchema = Joi.object({
  codigoPais: Joi.string().trim().max(2).required(),
  codigoIso3: Joi.string().trim().max(3).required(),
  codigoNumerico: Joi.string().trim().max(3).allow('', null),
  nombrePais: Joi.string().trim().max(100).required(),
  moneda: Joi.string().trim().max(3).required(),
  simboloMoneda: Joi.string().trim().max(5).allow('', null),
  decimalesMoneda: Joi.number().integer().min(0).max(4).allow('', null),
  indicativo: Joi.string().trim().max(6).allow('', null),
  zonaHoraria: Joi.string().trim().max(64).allow('', null),
  idioma: Joi.string().trim().max(10).allow('', null),
  descripcion: Joi.string().max(4000).allow('', null),
  estadoPais: Joi.boolean(),
});

const CodigoSchema = Joi.object({ codigoPais: Joi.string().trim().uppercase().length(2).required() }).unknown(true);

module.exports = { PaisSchema, CodigoSchema };
