/*
    Author: German Valencia
    Pattern: PORTTOS Repository - Cargas masivas (ingesta de archivos)
    Description: Vaciado e inserción por lotes de las tablas que se recargan completas desde archivo.
      Solo opera sobre las tablas de la lista blanca: el nombre de tabla nunca viene del cliente.
*/
const { sequelize } = require('../../database/connection');
const { crearError } = require('../../helpers/errores.helper');

const TABLAS_RECARGABLES = new Set([
  'TCL_RNDCOperacionTerrestre',
  'TCL_TraficoPortuarioMaritimo',
  'TCL_MaestroMatrizOperaciones',
  'TCL_HistoricosSupertransporte',
  'TCL_EventosViales',
]);

const validarTabla = (tabla) => {
  if (!TABLAS_RECARGABLES.has(tabla)) throw crearError(500, `Tabla no permitida para ingesta: ${tabla}`, 'TABLA_NO_PERMITIDA');
  return tabla;
};

module.exports = {
  /** TRUNCATE de una tabla recargable completa. */
  vaciar: (tabla, { transaction } = {}) => sequelize.query(`TRUNCATE TABLE dbo.${validarTabla(tabla)}`, { transaction }),
  /** Inserción por lote sin modelo (filas ya normalizadas). */
  insertarLote: (tabla, filas, { transaction } = {}) =>
    sequelize.getQueryInterface().bulkInsert(validarTabla(tabla), filas, { transaction }),
};
