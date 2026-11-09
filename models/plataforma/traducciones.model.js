/*
    Author: German Valencia
    Pattern: PLATAFORMA Model (Joi) - Llaves de traducción (OT-027)
*/
const Joi = require('joi');

const IDIOMA = Joi.string().trim().pattern(/^[a-z]{2}(-[A-Z]{2})?$/);
// llave del árbol: MODULO[.SUBMODULO].LLAVE (las que ya existen pueden tener minúsculas; las nuevas las revisa el núcleo)
const LLAVE = Joi.string().trim().max(300).pattern(/^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)+$/);

const IdiomaParamsSchema = Joi.object({ idioma: IDIOMA.required() }).unknown(true);

const LlaveTextosSchema = Joi.object({
  llave: LLAVE.required(),
  textos: Joi.object().pattern(IDIOMA, Joi.string().allow('').max(4000)).min(1).required(),
}).unknown(true);

const LlaveSchema = Joi.object({ llave: LLAVE.required() }).unknown(true);

const SembrarSchema = Joi.object({
  idioma: IDIOMA.required(),
  arbol: Joi.object().min(1).required(),
}).unknown(true);

module.exports = { IdiomaParamsSchema, LlaveTextosSchema, LlaveSchema, SembrarSchema };
