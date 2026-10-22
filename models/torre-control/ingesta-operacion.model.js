/*
    Author: German Valencia
    Pattern: PORTTOS DTO Pattern - Ingesta de operación portuaria y consultas de los tableros por pestaña
    Description: Contrato de POST /api/ingesta-operacion/:tipo (lo que envían las terminales u otros sistemas) y de
      GET /api/{granel,carga-suelta,capacidad,noticias}/:puerto. Campos en snake_case, iguales a las columnas.
      Cada registro se identifica por su código en el sistema de origen (codigo_externo, codigo_equipo, id_nodo...):
      reenviarlo actualiza, no duplica.
*/
const Joi = require('joi');
const { PuertoParamSchema } = require('./maritimo-vivo.model');

const fecha = Joi.string().isoDate();
const texto = (max) => Joi.string().trim().max(max);
const opcional = (max) => texto(max).allow(null, '');
const cantidad = Joi.number().min(0).max(1e9);

const OperacionBuque = Joi.object({
  codigo_externo: texto(80).required(),
  segmento: Joi.string().valid('GRANEL', 'RORO').required(),
  tipo: Joi.string().valid('AGRICOLA', 'MINERAL', 'LIQUIDO', 'VEHICULOS').required(),
  motonave: texto(100).required(),
  terminal: opcional(120), id_terminal: opcional(50), codigo_muelle: opcional(50), mmsi: opcional(20), naviera: opcional(120),
  producto: opcional(80),
  sentido: Joi.string().valid('IMPORTACION', 'EXPORTACION').default('IMPORTACION'),
  unidad: Joi.string().valid('TM', 'UNIDADES').required(),
  cantidad_total: cantidad.required(),
  cantidad_operada: cantidad.default(0),
  estado: Joi.string().valid('PROGRAMADA', 'FONDEADA', 'OPERANDO', 'SUSPENDIDA', 'TERMINADA').required(),
  eta: fecha.allow(null), fecha_inicio: fecha.allow(null), fecha_fin_estimada: fecha.allow(null), fecha_fin: fecha.allow(null),
});

const Avance = Joi.object({
  codigo_externo: texto(80).required(),     // de la operación
  hora: fecha.required(),                   // cualquier instante de la hora; se guarda el inicio de la hora
  cantidad: cantidad.required(),            // total operado en esa hora (TM o unidades)
});

const Equipo = Joi.object({
  codigo_equipo: texto(30).required(),
  tipo: Joi.string().valid('ASPIRADOR', 'GRUA_MOVIL', 'CINTA', 'VOLQUETA', 'SPMT', 'CAMA_BAJA', 'MONTACARGAS', 'REACH_STACKER', 'OTRO').required(),
  segmento: Joi.string().valid('GRANEL', 'CARGA_SUELTA', 'RORO', 'MULTI').required(),
  estado: Joi.string().valid('OPERANDO', 'LIBRE', 'EN_RUTA', 'MANTENIMIENTO').required(),
  descripcion: opcional(120), terminal: opcional(120), motonave: opcional(100), producto: opcional(80),
  capacidad_tmh: cantidad.allow(null), capacidad_ton: cantidad.allow(null), rendimiento_tmh: cantidad.allow(null),
  operacion_codigo_externo: opcional(80),   // operación de buque asignada
  folio_carga_suelta: opcional(30),
});

const FolioCargaSuelta = Joi.object({
  codigo_externo: texto(80).required(),
  folio: texto(30).required(),
  clase: Joi.string().valid('BREAK_BULK', 'PROJECT_CARGO').required(),
  producto: texto(120).required(),
  estado: Joi.string().valid('PROGRAMADO', 'EN_DESCARGA', 'EN_CARGUE', 'EN_PATIO', 'ESPERA_PERMISO', 'DESPACHADO').required(),
  cliente: opcional(120), motonave: opcional(100), naviera: opcional(120), terminal: opcional(120),
  sentido: Joi.string().valid('IMPORTACION', 'EXPORTACION').default('IMPORTACION'),
  bultos: Joi.number().integer().min(0).allow(null), bultos_recibidos: Joi.number().integer().min(0).allow(null),
  tm: cantidad.allow(null), peso_unitario_tm: cantidad.allow(null), dimensiones: opcional(60),
  equipo_requerido: opcional(60), ubicacion: opcional(120),
  requiere_permiso: Joi.boolean().default(false), permiso_aprobado: Joi.boolean().allow(null),
  fecha_programada: fecha.allow(null),
});

const InventarioVehiculos = Joi.object({
  id_nodo: texto(50).required(),            // patio (TCL_CapacidadNodos)
  marca: texto(60).required(),
  flujo: Joi.string().valid('IMPORTACION', 'EXPORTACION').required(),
  unidades: Joi.number().integer().min(0).required(),
  dias_promedio: Joi.number().min(0).max(365).allow(null),
  fecha_corte: fecha.required(),
});

const OcupacionNodo = Joi.object({
  id_nodo: texto(50).required(),            // TCL_CapacidadNodos.id_nodo o 'BOD-<id_bodega>'
  fecha: fecha.required(),
  ocupacion_pct: Joi.number().min(0).max(150).required(),
  ocupacion: cantidad.allow(null),
  ingresos_h: Joi.number().integer().min(0).allow(null), salidas_h: Joi.number().integer().min(0).allow(null),
  espera_min: Joi.number().integer().min(0).max(10000).allow(null),
});

const Nodo = Joi.object({
  id_nodo: texto(50).required(),
  nombre: texto(150).required(),
  categoria: Joi.string().valid('TERMINAL', 'PATIO_CONTENEDOR', 'DEPOT_VACIOS', 'PATIO_PDI', 'PATIO_BREAKBULK').required(),
  unidad_capacidad: Joi.string().valid('TEU', 'TON', 'UNIDADES', 'M2').required(),
  capacidad: cantidad.required(),
  operador: opcional(150), descripcion_capacidad: opcional(150), id_terminal: opcional(50),
  operaciones: Joi.array().items(texto(80)).max(20).default([]),
  activo: Joi.boolean().default(true),
});

/** tipo de la URL → { esquema del registro, módulo de socket a avisar } */
const TIPOS_INGESTA = Object.freeze({
  'operaciones-buque': { esquema: OperacionBuque, modulos: ['granel', 'suelta'] },
  avance: { esquema: Avance, modulos: ['granel', 'suelta'] },
  equipos: { esquema: Equipo, modulos: ['granel', 'suelta'] },
  'carga-suelta': { esquema: FolioCargaSuelta, modulos: ['suelta'] },
  vehiculos: { esquema: InventarioVehiculos, modulos: ['suelta', 'capacidad'] },
  'ocupacion-nodos': { esquema: OcupacionNodo, modulos: ['capacidad'] },
  nodos: { esquema: Nodo, modulos: ['capacidad'] },
});

const IngestaParamSchema = Joi.object({
  tipo: Joi.string().valid(...Object.keys(TIPOS_INGESTA)).required(),
});

const IngestaCuerpoSchema = Joi.object({
  puerto: Joi.string().trim().min(2).max(60).pattern(/^[\p{L}0-9 _-]+$/u).required(),
  fuente: Joi.string().valid('INGESTA_API', 'ARCHIVO').default('INGESTA_API'),
  registros: Joi.array().min(1).max(2000).required(),
});

module.exports = { PuertoParamSchema, TIPOS_INGESTA, IngestaParamSchema, IngestaCuerpoSchema };
