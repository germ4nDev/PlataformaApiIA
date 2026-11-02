/*
    Author: German Valencia
    Pattern: PORTTOS Repository - Movimientos de contenedores
    Description: Lecturas de TCL_MovimientosContenedor.
      Con la migración 008: los del puerto + los que no tienen puerto (datos anteriores sin clasificar).
      Sin la migración (columna inexistente): todos, como antes.
      Inventario en patio (TCL_InventarioContenedores) y escrituras del simulador (OT-009, migración 021): las filas
      simuladas van con fuente SIMULADOR y simulado = 1; lo real no se toca.
*/
const { Op, QueryTypes } = require('sequelize');
const { sequelize } = require('../../database/connection');
const { ContenedorMovimientoModel } = require('../../models/torre-control/contenedor-movimiento.model');
const { esColumnaInexistente, esTablaInexistente, migracionPendiente } = require('../../helpers/errores.helper');

const MIGRACION_021 = '021_fuente_simulado_tablas_operacion.sql';
const COLUMNAS_INVENTARIO = ['id_puerto', 'sigla_numero', 'codigo_iso', 'naviera', 'estado_carga', 'peso_tara_kg', 'peso_bruto_kg',
  'ubicacion_bloque', 'ubicacion_bahia', 'ubicacion_fila', 'ubicacion_altura', 'es_reefer', 'temp_requerida_celsius', 'codigo_imo',
  'fecha_ingreso', 'fecha_limite_freetime', 'estado_operativo', 'codigoUsuarioCreacion', 'fuente', 'simulado'];
const LOTE_INSERT = 90;   // 20 columnas × 90 = 1.800 parámetros, por debajo del tope de 2.100

async function q(sql, replacements = {}, type = QueryTypes.SELECT, opciones = {}) {
  try {
    return await sequelize.query(sql, { replacements, type, ...opciones });
  } catch (error) {
    if (esColumnaInexistente(error) || esTablaInexistente(error)) throw migracionPendiente(MIGRACION_021);
    throw error;
  }
}

const Movimiento = ContenedorMovimientoModel(sequelize);
const ORDEN = [['fechaCreacion', 'DESC']];

async function movimientosDelPuerto(puerto) {
  try {
    return await Movimiento.findAll({ raw: true, where: { [Op.or]: [{ id_puerto: puerto }, { id_puerto: null }] }, order: ORDEN });
  } catch (error) {
    if (!esColumnaInexistente(error)) throw error;
    return Movimiento.findAll({ raw: true, attributes: { exclude: ['id_puerto'] }, order: ORDEN });
  }
}

/** Inventario en patio del puerto (todas las columnas; con la 021 trae también fuente y simulado). */
function inventarioDelPuerto(idsPuerto) {
  return sequelize.query('SELECT * FROM dbo.TCL_InventarioContenedores WITH (NOLOCK) WHERE id_puerto IN (:ids)',
    { replacements: { ids: [].concat(idsPuerto) }, type: QueryTypes.SELECT });
}

/** ¿Hay inventario real (simulado = 0) del puerto? */
async function hayInventarioReal(idPuerto) {
  const [fila] = await q('SELECT COUNT(1) AS n FROM dbo.TCL_InventarioContenedores WITH (NOLOCK) WHERE id_puerto = :idPuerto AND simulado = 0', { idPuerto });
  return Number(fila?.n || 0) > 0;
}

/** Cambia el inventario simulado del puerto por 'filas' (una transacción). Devuelve cuántas escribió. */
function reemplazarInventarioSimulado(idPuerto, filas) {
  const fijos = { id_puerto: idPuerto, codigoUsuarioCreacion: 'SIMULADOR', fuente: 'SIMULADOR', simulado: 1 };
  const valor = (f, c) => (c in fijos ? fijos[c] : c === 'es_reefer' ? (f.es_reefer ? 1 : 0) : (f[c] === undefined ? null : f[c]));
  return sequelize.transaction(async (transaction) => {
    await q('DELETE FROM dbo.TCL_InventarioContenedores WHERE id_puerto = :idPuerto AND simulado = 1', { idPuerto }, QueryTypes.DELETE, { transaction });
    for (let i = 0; i < filas.length; i += LOTE_INSERT) {
      const replacements = {};
      const valores = filas.slice(i, i + LOTE_INSERT).map((f, j) => '(' + COLUMNAS_INVENTARIO.map((c) => {
        replacements[c + '_' + j] = valor(f, c);
        return ':' + c + '_' + j;
      }).join(', ') + ')');
      await q('INSERT INTO dbo.TCL_InventarioContenedores (' + COLUMNAS_INVENTARIO.join(', ') + ') VALUES ' + valores.join(',\n'),
        replacements, QueryTypes.INSERT, { transaction });
    }
    return filas.length;
  });
}

const retirarInventarioSimulado = (idPuerto) =>
  q('DELETE FROM dbo.TCL_InventarioContenedores WHERE id_puerto = :idPuerto AND simulado = 1', { idPuerto }, QueryTypes.DELETE);

module.exports = { movimientosDelPuerto, inventarioDelPuerto, hayInventarioReal, reemplazarInventarioSimulado, retirarInventarioSimulado };
