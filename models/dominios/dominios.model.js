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

// Utilidades › Dominios (CC-224): un registro de PTL_DominiosAP. Las reglas de fondo están en el núcleo (revisarRegistro).
const IdParamsSchema = Joi.object({ id: Joi.number().integer().positive().required() });
const texto = (max) => Joi.string().trim().max(max).allow('', null);
const DominioSchema = Joi.object({
  dominio: Joi.string().trim().max(300).required(),
  tipo: Joi.string().trim().valid('consola', 'aplicacion').required(),
  codigoAplicacion: texto(200),
  codigoSuite: texto(200),
  rutaPortal: texto(200),
  rutaInicio: texto(200),
  nombreMarca: texto(100),
  logoMarca: texto(300),
  descripcion: texto(4000),
  estado: Joi.alternatives(Joi.boolean(), Joi.number().valid(0, 1), Joi.string().valid('0', '1', 'true', 'false')).optional(),
}).unknown(true);

module.exports = { ContextoQuerySchema, AplicacionParamsSchema, DominiosAplicacionSchema, IdParamsSchema, DominioSchema };
