/*
    Author: German Valencia
    Pattern: PORTTOS Model (Joi) - Portal público porttos.co (migración 025)
*/
const Joi = require('joi');
const { PAGINAS, IDIOMAS, MOTIVOS } = require('../../utils/portal/portal');

const PaginaParamsSchema = Joi.object({
  pagina: Joi.string().trim().lowercase().valid(...PAGINAS).required(),
});

const IdiomaQuerySchema = Joi.object({
  idioma: Joi.string().trim().lowercase().valid(...IDIOMAS).default('es'),
}).unknown(true);

const MensajeBodySchema = Joi.object({
  motivo: Joi.string().trim().uppercase().valid(...Object.keys(MOTIVOS)).required(),
  codigoPlan: Joi.string().trim().uppercase().max(40).pattern(/^[A-Z0-9_]+$/).allow('', null),
  nombre: Joi.string().trim().min(2).max(120).required(),
  empresa: Joi.string().trim().max(160).allow('', null),
  correo: Joi.string().trim().lowercase().email({ tlds: { allow: false } }).max(160).required(),
  telefono: Joi.string().trim().max(40).pattern(/^[0-9+()\s.-]*$/).allow('', null),
  puerto: Joi.string().trim().max(60).allow('', null),
  mensaje: Joi.string().trim().min(10).max(4000).required(),
  aceptaDatos: Joi.boolean().valid(true).required(),
  // Campo trampa: invisible para personas; si llega lleno es un robot
  sitioWeb: Joi.string().max(200).allow('', null),
});

// Puertos en vivo: id o nombre del puerto ('<PUERTO>' o el nombre con espacios); el servicio lo busca entre los activos del maestro
const PuertoParamsSchema = Joi.object({
  puerto: Joi.string().trim().min(2).max(60).pattern(/^[\p{L}0-9 _.-]+$/u).required(),
});

module.exports = { PaginaParamsSchema, IdiomaQuerySchema, MensajeBodySchema, PuertoParamsSchema };
