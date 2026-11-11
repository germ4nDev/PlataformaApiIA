/*
    Author: German Valencia
    Pattern: PLATAFORMA Model (Joi) - Listas de precios y su detalle (OT-029)
    Las tablas (Sequelize) siguen en models/lista-precios.model.js.
*/
const Joi = require('joi');

const CODIGO = Joi.string().trim().max(200);
const VALOR = Joi.number().precision(2).min(0);

const ListaSchema = Joi.object({
  codigoLista: CODIGO.uppercase().required(),
  nombreLista: Joi.string().trim().max(150).required(),
  moneda: Joi.string().trim().uppercase().pattern(/^[A-Z]{3}$/).required(),
  paisAplica: Joi.string().trim().max(100).allow('', null).default(''),
  fechaInicio: Joi.date().iso().required(),
  fechaFin: Joi.date().iso().allow(null, '').default(null),
  estadoLista: Joi.boolean().default(true),
});

const DetalleSchema = Joi.object({
  codigoDetalle: CODIGO.required(),
  tipoReferencia: Joi.string().trim().uppercase().valid('PAQUETE', 'ITEM').required(),
  codigoReferencia: CODIGO.required(),
  valorMensual: VALOR.required(),
  valorAnual: VALOR.default(0),
  precioSetup: VALOR.default(0),
  estadoDetalle: Joi.boolean().default(true),
});

const DetalleCambiosSchema = Joi.object({
  valorMensual: VALOR, valorAnual: VALOR, precioSetup: VALOR, estadoDetalle: Joi.boolean(),
}).min(1);

const DuplicarSchema = Joi.object({
  codigoLista: CODIGO.uppercase().required(),
  nombreLista: Joi.string().trim().max(150).required(),
  fechaInicio: Joi.date().iso().required(),
  fechaFin: Joi.date().iso().allow(null, '').default(null),
  porcentajeAjuste: Joi.number().min(-100).max(1000).default(0),
});

const VigenteSchema = Joi.object({
  pais: Joi.string().trim().max(100).allow('').default(''),
  moneda: Joi.string().trim().uppercase().max(3).allow('').default(''),
  fecha: Joi.date().iso().allow('').default(() => new Date()),
}).unknown(true);

const CotizarSchema = Joi.object({
  codigoPaquete: CODIGO.required(),
  codigoTipoPaquete: CODIGO.required(),
  codigoLista: CODIGO.allow('').default(''),
}).unknown(true);

module.exports = { ListaSchema, DetalleSchema, DetalleCambiosSchema, DuplicarSchema, VigenteSchema, CotizarSchema };
