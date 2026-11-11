/*
    Author: German Valencia
    Pattern: PLATAFORMA Model (Joi) - Aprovisionamiento de bases por suscriptor (OT-030)
*/
const Joi = require('joi');

const CODIGO = Joi.string().trim().max(200);
const SuscriptorSchema = Joi.object({ codigoSuscriptor: CODIGO.required() }).unknown(true);
const ReintentarSchema = Joi.object({ codigoSuscriptor: CODIGO.required(), codigoAplicacion: CODIGO.required() }).unknown(true);

module.exports = { SuscriptorSchema, ReintentarSchema };
