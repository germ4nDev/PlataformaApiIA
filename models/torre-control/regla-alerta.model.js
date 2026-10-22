/*
    Author: German Valencia
    DTO: Configuración de una regla de alertas del mapa (TCL_ConfigAlertas)
*/
const Joi = require('joi');
const { CATALOGO_REGLAS } = require('../../utils/reglas-alertas');

const umbral = Joi.number().min(0).max(1000000).allow(null);

const esquemaReglaAlerta = Joi.object({
  codigo_regla: Joi.string().valid(...Object.keys(CATALOGO_REGLAS)).required(),
  id_puerto: Joi.string().trim().uppercase().pattern(/^(\*|[A-Z0-9_]{2,40})$/).default('*'),
  activa: Joi.boolean().required(),
  umbral_1: umbral,
  umbral_2: umbral,
  umbral_3: umbral,
  enfriamiento_min: Joi.number().integer().min(1).max(1440).required(),
});

module.exports = { esquemaReglaAlerta };
