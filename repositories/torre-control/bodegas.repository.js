/*
    Author: German Valencia
    Repository: Bodegas y Silos - Consultas SQL Aisladas (Sequelize QueryTypes)
*/
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../../database/connection');
const { MaestroBodegaModel } = require('../../models/torre-control/bodegas.model');
const { MovimientoBodegaModel } = require('../../models/torre-control/movimientos-bodega.model');
const { esColumnaInexistente, esTablaInexistente, migracionPendiente } = require('../../helpers/errores.helper');

const MIGRACION_021 = '021_fuente_simulado_tablas_operacion.sql';
const LOTE_INSERT = 80;   // 16 columnas × 80 = 1.280 parámetros, por debajo del tope de 2.100

// El puerto se escribe distinto según quién cargó la fila ('SANTA MARTA', 'SANTA_MARTA'): se compara normalizado
// (mayúsculas, espacios → '_') contra la lista que arma el servicio (clave del selector + id del maestro). OT-009.
const PUERTO_NORMALIZADO = "REPLACE(UPPER(LTRIM(RTRIM(id_puerto))), ' ', '_')";
const clavesPuerto = (puerto) => [...new Set([].concat(puerto).filter(Boolean)
  .map((p) => String(p).trim().toUpperCase().replace(/\s+/g, '_')))];

/** Lee con la columna simulado (migración 021); si aún no existe, repite la consulta sin ella. */
async function conSimulado(armar, opciones) {
  try {
    return await sequelize.query(armar(', CAST(simulado AS INT) AS simulado'), opciones);
  } catch (error) {
    if (!esColumnaInexistente(error)) throw error;
    return sequelize.query(armar(''), opciones);
  }
}

/** Escrituras del simulador: sin la 021 lanzan migracionPendiente. */
async function q(sql, replacements = {}, type = QueryTypes.SELECT, opciones = {}) {
  try {
    return await sequelize.query(sql, { replacements, type, ...opciones });
  } catch (error) {
    if (esColumnaInexistente(error) || esTablaInexistente(error)) throw migracionPendiente(MIGRACION_021);
    throw error;
  }
}

const Bodega = MaestroBodegaModel(sequelize);
const MovimientoBodega = MovimientoBodegaModel(sequelize);

const COLUMNAS_BODEGA = `
  id_bodega, id_puerto, codigo_bodega, nombre_bodega, tipo_almacenamiento, tipo_carga_principal,
  CAST(capacidad_maxima_ton AS FLOAT) AS capacidad_maxima_ton,
  CAST(inventario_actual_ton AS FLOAT) AS inventario_actual_ton,
  CAST(CASE WHEN capacidad_maxima_ton > 0 THEN ROUND((inventario_actual_ton / capacidad_maxima_ton) * 100, 1) ELSE 0 END AS FLOAT) AS ocupacion_pct,
  CAST(temperatura_c AS FLOAT) AS temperatura_c,
  CAST(humedad_relativa_pct AS FLOAT) AS humedad_relativa_pct,
  estado_operativo, activo, codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion`;

class BodegasRepository {
  async obtenerMaestroBodegasPorPuerto(puerto) {
    const query = (simulado) => `
            SELECT
                id_bodega,
                id_puerto,
                codigo_bodega,
                nombre_bodega,
                tipo_almacenamiento,
                tipo_carga_principal,
                CAST(capacidad_maxima_ton AS FLOAT) AS capacidad_maxima_ton,
                CAST(inventario_actual_ton AS FLOAT) AS inventario_actual_ton,
                CAST(
                    CASE WHEN capacidad_maxima_ton > 0
                         THEN ROUND((inventario_actual_ton / capacidad_maxima_ton) * 100, 1)
                         ELSE NULL  -- sin capacidad no hay porcentaje (antes 0 %, que se veía como bodega vacía)
                    END AS FLOAT
                ) AS ocupacion_pct,
                CAST(temperatura_c AS FLOAT) AS temperatura_c,
                CAST(humedad_relativa_pct AS FLOAT) AS humedad_relativa_pct,
                estado_operativo,
                activo,
                codigoUsuarioCreacion,
                fechaCreacion,
                codigoUsuarioModificacion,
                fechaModificacion${simulado}
            FROM dbo.TCL_MaestroBodegas WITH (NOLOCK)
            WHERE ${PUERTO_NORMALIZADO} IN (:puertos)
              AND activo = 1
            ORDER BY ocupacion_pct DESC, codigo_bodega ASC;
        `;

    return conSimulado(query, { replacements: { puertos: clavesPuerto(puerto) }, type: QueryTypes.SELECT });
  }

  async obtenerMovimientosBodegaPorPuerto(puerto) {
    const query = `
            SELECT TOP 50
                id_movimiento_bodega,
                id_puerto,
                id_bodega,
                nombre_bodega,
                lote_bl,
                producto,
                tipo_operacion,
                CAST(toneladas AS FLOAT) AS toneladas,
                cliente,
                dias_almacenaje,
                estado,
                activo,
                codigoUsuarioCreacion,
                fechaCreacion,
                codigoUsuarioModificacion,
                fechaModificacion
            FROM dbo.TCL_MovimientosBodega WITH (NOLOCK)
            WHERE ${PUERTO_NORMALIZADO} IN (:puertos)
              AND activo = 1
            ORDER BY id_movimiento_bodega DESC;
        `;

    return await sequelize.query(query, {
      replacements: { puertos: clavesPuerto(puerto) },
      type: QueryTypes.SELECT
    });
  }

  /**
   * Movimientos del puerto desde una fecha (Fase 1, 2026-10-23): reemplaza al TOP 50 sin fecha para el tablero.
   * fechaCreacion se guarda como texto ISO; las filas con otro formato quedan fuera (TRY_CONVERT → NULL).
   * Trae como máximo :limite filas y en `total_rango` cuántas había en el rango.
   */
  async obtenerMovimientosBodegaDesde(puerto, desdeIso, limite = 500) {
    const query = (simulado) => `
            SELECT TOP (:limite)
                id_movimiento_bodega, id_puerto, id_bodega, nombre_bodega, lote_bl, producto, tipo_operacion,
                CAST(toneladas AS FLOAT) AS toneladas, cliente, dias_almacenaje, estado, activo,
                codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion,
                COUNT(*) OVER () AS total_rango${simulado}
            FROM dbo.TCL_MovimientosBodega WITH (NOLOCK)
            WHERE ${PUERTO_NORMALIZADO} IN (:puertos)
              AND activo = 1
              AND TRY_CONVERT(datetimeoffset, fechaCreacion) >= TRY_CONVERT(datetimeoffset, :desde)
            ORDER BY TRY_CONVERT(datetimeoffset, fechaCreacion) DESC, id_movimiento_bodega DESC;
        `;

    return conSimulado(query, { replacements: { puertos: clavesPuerto(puerto), desde: desdeIso, limite }, type: QueryTypes.SELECT });
  }

  async obtenerResumenPorTipoCarga(puerto) {
    const query = `
            SELECT
                ISNULL(tipo_carga_principal, 'Carga General') AS tipo_carga,
                CAST(SUM(inventario_actual_ton) AS FLOAT) AS total_toneladas,
                CAST(SUM(capacidad_maxima_ton) AS FLOAT) AS capacidad_toneladas,
                COUNT(id_bodega) AS cantidad_bodegas
            FROM dbo.TCL_MaestroBodegas WITH (NOLOCK)
            WHERE ${PUERTO_NORMALIZADO} IN (:puertos)
              AND activo = 1
            GROUP BY ISNULL(tipo_carga_principal, 'Carga General')
            ORDER BY total_toneladas DESC;
        `;

    return await sequelize.query(query, {
      replacements: { puertos: clavesPuerto(puerto) },
      type: QueryTypes.SELECT
    });
  }

  // ================================================================
  // ESCRITURA (Sequelize + transacción). Agregado 2026-10-17: antes el
  // controlador llamaba métodos que no existían y todo POST/PUT respondía 500.
  // ================================================================

  /** Bodega con las columnas calculadas del tablero (ocupacion_pct), dentro de la transacción si se pasa. */
  async obtenerBodegaPorId(idBodega, transaction) {
    const [fila] = await sequelize.query(
      `SELECT ${COLUMNAS_BODEGA} FROM dbo.TCL_MaestroBodegas WHERE id_bodega = :idBodega`,
      { replacements: { idBodega }, type: QueryTypes.SELECT, transaction });
    return fila || null;
  }

  async existePuerto(idPuerto, transaction) {
    const [fila] = await sequelize.query(
      'SELECT 1 AS ok FROM dbo.TCL_MaestroPuertos WHERE UPPER(LTRIM(RTRIM(id_puerto))) = :idPuerto',
      { replacements: { idPuerto }, type: QueryTypes.SELECT, transaction });
    return Boolean(fila);
  }

  /**
   * Lee y BLOQUEA la fila hasta el fin de la transacción: dos movimientos simultáneos no pisan el inventario.
   * Ojo: en SQL Server Sequelize ignora la opción { lock } (dialecto mssql: supports.lock = false),
   * por eso el bloqueo va explícito con WITH (UPDLOCK, HOLDLOCK).
   */
  async bloquearBodega(idBodega, transaction) {
    const [fila] = await sequelize.query(
      `SELECT ${COLUMNAS_BODEGA} FROM dbo.TCL_MaestroBodegas WITH (UPDLOCK, HOLDLOCK) WHERE id_bodega = :idBodega`,
      { replacements: { idBodega }, type: QueryTypes.SELECT, transaction });
    return fila || null;
  }

  /** HOLDLOCK también bloquea el rango vacío: evita que dos altas simultáneas creen el mismo código. */
  async buscarPorCodigo(idPuerto, codigoBodega, transaction) {
    const [fila] = await sequelize.query(
      `SELECT id_bodega FROM dbo.TCL_MaestroBodegas WITH (UPDLOCK, HOLDLOCK)
       WHERE UPPER(LTRIM(RTRIM(id_puerto))) = :idPuerto AND codigo_bodega = :codigoBodega`,
      { replacements: { idPuerto, codigoBodega }, type: QueryTypes.SELECT, transaction });
    return fila || null;
  }

  crearBodega(registro, transaction) {
    return Bodega.create(registro, { transaction });
  }

  actualizarBodega(idBodega, cambios, transaction) {
    return Bodega.update(cambios, { where: { id_bodega: idBodega }, transaction });
  }

  crearMovimiento(registro, transaction) {
    return MovimientoBodega.create(registro, { transaction });
  }

  enTransaccion(trabajo) {
    return sequelize.transaction(trabajo);
  }

  // ================================================================
  // SIMULADOR (OT-009, migración 021): catálogo y movimientos con fuente = 'SIMULADOR' y simulado = 1.
  // Lo real nunca se toca: todas las escrituras filtran simulado = 1.
  // ================================================================

  crearBodegaSimulada(idPuerto, b, ahoraIso) {
    return q(`
      INSERT INTO dbo.TCL_MaestroBodegas (id_puerto, codigo_bodega, nombre_bodega, tipo_almacenamiento, tipo_carga_principal,
        capacidad_maxima_ton, inventario_actual_ton, temperatura_c, humedad_relativa_pct, estado_operativo, activo,
        codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion, fuente, simulado)
      VALUES (:idPuerto, :codigo_bodega, :nombre_bodega, :tipo_almacenamiento, :tipo_carga_principal, :capacidad_maxima_ton,
        :inventario_actual_ton, :temperatura_c, :humedad_relativa_pct, :estado_operativo, 1,
        'SIMULADOR', :ahora, 'SIMULADOR', :ahora, 'SIMULADOR', 1)`,
    { idPuerto, ...b, ahora: ahoraIso }, QueryTypes.INSERT);
  }

  actualizarInventarioSimulado(idBodega, inventarioTon, estado, ahoraIso) {
    return q(`
      UPDATE dbo.TCL_MaestroBodegas
      SET inventario_actual_ton = :inventarioTon, estado_operativo = :estado, codigoUsuarioModificacion = 'SIMULADOR', fechaModificacion = :ahora
      WHERE id_bodega = :idBodega AND simulado = 1`, { idBodega, inventarioTon, estado, ahora: ahoraIso }, QueryTypes.UPDATE);
  }

  /** ¿Hay algún movimiento real (simulado = 0) del puerto desde 'desdeIso'? */
  async hayMovimientosReales(puerto, desdeIso) {
    const [fila] = await q(`
      SELECT COUNT(1) AS n FROM dbo.TCL_MovimientosBodega WITH (NOLOCK)
      WHERE ${PUERTO_NORMALIZADO} IN (:puertos) AND activo = 1 AND simulado = 0
        AND TRY_CONVERT(datetimeoffset, fechaCreacion) >= TRY_CONVERT(datetimeoffset, :desde)`,
    { puertos: clavesPuerto(puerto), desde: desdeIso });
    return Number(fila?.n || 0) > 0;
  }

  /** Cambia los movimientos simulados del puerto por 'filas' (una transacción). Devuelve cuántos escribió. */
  reemplazarMovimientosSimulados(idPuerto, filas) {
    const columnas = ['id_puerto', 'id_bodega', 'nombre_bodega', 'lote_bl', 'producto', 'tipo_operacion', 'toneladas', 'cliente',
      'dias_almacenaje', 'estado', 'fechaCreacion', 'fechaModificacion', 'codigoUsuarioCreacion', 'codigoUsuarioModificacion',
      'fuente', 'simulado'];
    const valor = (f, c, idPuerto) => ({
      id_puerto: idPuerto, fechaModificacion: f.fechaCreacion, codigoUsuarioCreacion: 'SIMULADOR',
      codigoUsuarioModificacion: 'SIMULADOR', fuente: 'SIMULADOR', simulado: 1,
    }[c] ?? (f[c] === undefined ? null : f[c]));
    return sequelize.transaction(async (transaction) => {
      await q('DELETE FROM dbo.TCL_MovimientosBodega WHERE id_puerto = :idPuerto AND simulado = 1', { idPuerto }, QueryTypes.DELETE, { transaction });
      for (let i = 0; i < filas.length; i += LOTE_INSERT) {
        const replacements = {};
        const valores = filas.slice(i, i + LOTE_INSERT).map((f, j) => `(${columnas.map((c) => {
          replacements[`${c}_${j}`] = valor(f, c, idPuerto);
          return `:${c}_${j}`;
        }).join(', ')})`);
        await q(`INSERT INTO dbo.TCL_MovimientosBodega (${columnas.join(', ')}) VALUES ${valores.join(',\n')}`,
          replacements, QueryTypes.INSERT, { transaction });
      }
      return filas.length;
    });
  }

  /** Retira los movimientos simulados del puerto y, con 'conCatalogo', también sus bodegas simuladas. */
  async retirarSimulados(idPuerto, { conCatalogo = false } = {}) {
    await q('DELETE FROM dbo.TCL_MovimientosBodega WHERE id_puerto = :idPuerto AND simulado = 1', { idPuerto }, QueryTypes.DELETE);
    if (conCatalogo) await q('DELETE FROM dbo.TCL_MaestroBodegas WHERE id_puerto = :idPuerto AND simulado = 1', { idPuerto }, QueryTypes.DELETE);
  }
}

module.exports = new BodegasRepository();
module.exports.Bodega = Bodega;
module.exports.MovimientoBodega = MovimientoBodega;