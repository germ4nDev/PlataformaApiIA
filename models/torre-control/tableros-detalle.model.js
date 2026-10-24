/*
    Author: German Valencia
    Pattern: PORTTOS DTO Pattern - Detalle bajo demanda de los tableros por pestaña (vista ampliada, Fase 3)
    Description: Esquemas Joi de las consultas que el front hace solo al ampliar un widget:
      GET /api/tableros/granel/:puerto/avance      ?horas=24|72|168 &idOperacion=
      GET /api/tableros/capacidad/:puerto/serie    ?horas=24|72|168 &idNodo=
      GET /api/tableros/noticias/:puerto/trm       ?dias=7..90
      GET /api/tablero-control/bodegas/ocupacion        ?puerto&horas
      GET /api/tablero-control/bodegas/movimientos/rango ?puerto&dias=1..90
*/
const Joi = require('joi');

const horas = Joi.number().integer().valid(24, 72, 168).default(24);
const id = Joi.string().trim().max(60).pattern(/^[\w.-]+$/);

const AvanceQuerySchema = Joi.object({ horas, idOperacion: id.optional() });
const SerieNodoQuerySchema = Joi.object({ horas, idNodo: id.required() });
const TrmQuerySchema = Joi.object({ dias: Joi.number().integer().min(7).max(90).default(30) });

/** Bodegas (rutas /api/tablero-control/bodegas/...): el puerto llega por query. */
const puertoQuery = Joi.string().trim().min(2).max(60).pattern(/^[\p{L}0-9 _-]+$/u).default('BUENAVENTURA');
const BodegasOcupacionQuerySchema = Joi.object({ puerto: puertoQuery, horas });
const HistorialGnlQuerySchema = Joi.object({ horas: Joi.number().integer().valid(24, 72, 168) });
const BodegasMovimientosQuerySchema = Joi.object({ puerto: puertoQuery, dias: Joi.number().integer().min(1).max(90).default(30) });

module.exports = { AvanceQuerySchema, SerieNodoQuerySchema, TrmQuerySchema, BodegasOcupacionQuerySchema, BodegasMovimientosQuerySchema, HistorialGnlQuerySchema };
