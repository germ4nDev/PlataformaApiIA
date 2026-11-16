/*
    Author: German Valencia
    Pattern: PLATAFORMA Model (Joi) - Administración de pestañas y tipos de pestaña (CC-203)
    La forma de entrada; las reglas finas (código, color, ícono, estrategia) están en utils/plataforma/pestanas.js.
*/
const Joi = require('joi');

const auditoria = {
  codigoUsuarioCreacion: Joi.any().strip(),
  fechaCreacion: Joi.any().strip(),
  codigoUsuarioModificacion: Joi.any().strip(),
  fechaModificacion: Joi.any().strip(),
};

const PestanaSchema = Joi.object({
  codigoPestana: Joi.string().trim().max(50).required(),
  codigoTipoPestana: Joi.string().trim().max(200).required(),
  codigoAplicacion: Joi.string().trim().max(200).required(),
  codigoSuite: Joi.string().trim().max(200).required(),
  nombrePestana: Joi.string().trim().max(100).required(),
  orden: Joi.number().integer().min(0).allow(null, '').default(0),
  descripcion: Joi.string().max(4000).allow('', null),
  estado: Joi.boolean().truthy(1, '1').falsy(0, '0').default(true),
  icono: Joi.string().trim().max(60).allow('', null),
  color: Joi.string().trim().max(9).allow('', null),
  ...auditoria,
}).unknown(true);

const TipoPestanaSchema = Joi.object({
  codigoTipo: Joi.string().trim().max(50).required(),
  estrategia: Joi.string().trim().max(50).required(),
  descripcion: Joi.string().max(500).allow('', null),
  estado: Joi.boolean().truthy(1, '1').falsy(0, '0').default(true),
  ...auditoria,
}).unknown(true);

const CodigoSchema = Joi.object({ id: Joi.string().trim().max(200).required() }).unknown(true);

module.exports = { PestanaSchema, TipoPestanaSchema, CodigoSchema };
