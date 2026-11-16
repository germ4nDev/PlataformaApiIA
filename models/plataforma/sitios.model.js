/*
    Author: German Valencia
    Pattern: PLATAFORMA Model (Joi) - Sitios (OT-036 fase 2). El formato fino lo revisa utils/plataforma/sitios.js.
*/
const Joi = require('joi');

const SitioSchema = Joi.object({
  codigoSitio: Joi.string().max(250).allow('', null),
  codigoAplicacion: Joi.string().max(200).allow('', null),
  nombreSitio: Joi.string().max(150).allow('', null),
  descripcionSitio: Joi.string().max(4000).allow('', null),
  urlSitio: Joi.string().max(150).allow('', null),
  puertoSitio: Joi.alternatives().try(Joi.number(), Joi.string().max(10).allow('')).allow(null),
  estadoSitio: Joi.alternatives().try(Joi.boolean(), Joi.number().valid(0, 1), Joi.string().valid('0', '1', 'true', 'false')).allow(null, ''),
  rutaAdministracion: Joi.string().max(250).allow('', null),
});

const IdSchema = Joi.object({ id: Joi.string().trim().min(1).max(200).required() }).unknown(true);

module.exports = { SitioSchema, IdSchema };
