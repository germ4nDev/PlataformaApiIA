/*
    Author: German Valencia
    Pattern: PORTTOS Repository - Metadatos de las pestañas para el layout y la barra de pestañas (OT-008; solo lectura)
    Description: Lo que web y app necesitan de cada pestaña y que /api/layout/plantilla no entrega bien: ese servicio lee la
      estrategia y la zona de PTLLayoutPestanas (preferencias por usuario) con un findOne y, por ejemplo, devuelve Marítimo
      como ESTATICO_ANALITICO y sin zona. La regla 7 no deja tocar /api/layout, así que aquí se leen de las tablas que mandan:
      - estilos()          → { CODIGO: { icono, color } } de PTLPestanas (migración 020; sin ella, migracionPendiente)
      - zonas()            → { CODIGO: { codigoMolde, inicioX, inicioY, colsPorItem, rowsPorItem } } de PTLCfgZonasDinamicas
      - estrategias()      → { CODIGO: codigoTipoPestana } de PTLPestanas
      El modelo de Sequelize de PTLPestanas no declara icono ni color a propósito (tabla compartida; la 020 es opcional).
*/
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../database/connection');
const { esColumnaInexistente, esTablaInexistente, migracionPendiente } = require('../helpers/errores.helper');

const MIGRACION_020 = '020_pestanas_icono_color.sql';
const consultar = (sql) => sequelize.query(sql, { type: QueryTypes.SELECT });
const clave = (c) => String(c || '').trim().toUpperCase();
const n = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

async function estilos() {
  try {
    const filas = await consultar('SELECT codigoPestana, icono, color FROM dbo.PTLPestanas WHERE icono IS NOT NULL OR color IS NOT NULL;');
    return Object.fromEntries(filas.map((f) => [clave(f.codigoPestana), { icono: f.icono ?? null, color: f.color ?? null }]));
  } catch (error) {
    if (esColumnaInexistente(error)) throw migracionPendiente(MIGRACION_020);
    throw error;
  }
}

/** Zona dinámica activa por pestaña (la tabla no tiene maxItemsPorFila: la regla usa las que caben en 12 columnas). */
async function zonas() {
  try {
    const filas = await consultar(`SELECT codigoPestana, codigoMolde, inicioX, inicioY, colsPorItem, rowsPorItem
      FROM dbo.PTLCfgZonasDinamicas WHERE ISNULL(estado, 1) = 1;`);
    return Object.fromEntries(filas.map((z) => [clave(z.codigoPestana), {
      codigoMolde: z.codigoMolde ?? null, inicioX: n(z.inicioX), inicioY: n(z.inicioY), colsPorItem: n(z.colsPorItem), rowsPorItem: n(z.rowsPorItem),
    }]));
  } catch (error) {
    if (esTablaInexistente(error) || esColumnaInexistente(error)) return {};
    throw error;
  }
}

async function estrategias() {
  const filas = await consultar('SELECT codigoPestana, codigoTipoPestana FROM dbo.PTLPestanas;');
  return Object.fromEntries(filas.map((f) => [clave(f.codigoPestana), f.codigoTipoPestana ?? null]));
}

module.exports = { MIGRACION_020, estilos, zonas, estrategias };
