/*
    Author: German Valencia
    Pattern: PLATAFORMA Model (Joi) - Catálogos simples (CC-204). La forma la da la definición del catálogo
    (utils/plataforma/catalogos.js); el formato fino lo revisa el núcleo.
*/
const Joi = require('joi');

const valorDe = (c) => {
  if (c.tipo === 'entero' || c.tipo === 'decimal') return Joi.alternatives().try(Joi.number(), Joi.string().trim().max(30).allow('')).allow(null);
  return Joi.string().max(c.tipo === 'codigo' ? c.max + 50 : c.max + 50).allow('', null);
};

function esquemaDe(def) {
  const llaves = {};
  for (const c of def.campos) llaves[c.nombre] = valorDe(c);
  if (def.estado) llaves[def.estado] = Joi.alternatives().try(Joi.boolean(), Joi.number().valid(0, 1), Joi.string().valid('0', '1', 'true', 'false')).allow(null, '');
  return Joi.object(llaves);
}

const IdSchema = Joi.object({ id: Joi.string().trim().min(1).max(200).required() }).unknown(true);

module.exports = { esquemaDe, IdSchema };
