/*
    Author: German Valencia
    Repository: Bodegas y Silos - Consultas SQL Aisladas (Sequelize QueryTypes)
*/
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../../database/connection');
const { MaestroBodegaModel } = require('../../models/torre-control/bodegas.model');
const { MovimientoBodegaModel } = require('../../models/torre-control/movimientos-bodega.model');

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
    const query = `
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
                fechaModificacion
            FROM dbo.TCL_MaestroBodegas WITH (NOLOCK)
            WHERE UPPER(LTRIM(RTRIM(id_puerto))) = :puerto
              AND activo = 1
            ORDER BY ocupacion_pct DESC, codigo_bodega ASC;
        `;

    return await sequelize.query(query, {
      replacements: { puerto },
      type: QueryTypes.SELECT
    });
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
            WHERE UPPER(LTRIM(RTRIM(id_puerto))) = :puerto
              AND activo = 1
            ORDER BY id_movimiento_bodega DESC;
        `;

    return await sequelize.query(query, {
      replacements: { puerto },
      type: QueryTypes.SELECT
    });
  }

  /**
   * Movimientos del puerto desde una fecha (Fase 1, 2026-10-23): reemplaza al TOP 50 sin fecha para el tablero.
   * fechaCreacion se guarda como texto ISO; las filas con otro formato quedan fuera (TRY_CONVERT → NULL).
   * Trae como máximo :limite filas y en `total_rango` cuántas había en el rango.
   */
  async obtenerMovimientosBodegaDesde(puerto, desdeIso, limite = 500) {
    const query = `
            SELECT TOP (:limite)
                id_movimiento_bodega, id_puerto, id_bodega, nombre_bodega, lote_bl, producto, tipo_operacion,
                CAST(toneladas AS FLOAT) AS toneladas, cliente, dias_almacenaje, estado, activo,
                codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion,
                COUNT(*) OVER () AS total_rango
            FROM dbo.TCL_MovimientosBodega WITH (NOLOCK)
            WHERE UPPER(LTRIM(RTRIM(id_puerto))) = :puerto
              AND activo = 1
              AND TRY_CONVERT(datetimeoffset, fechaCreacion) >= TRY_CONVERT(datetimeoffset, :desde)
            ORDER BY TRY_CONVERT(datetimeoffset, fechaCreacion) DESC, id_movimiento_bodega DESC;
        `;

    return await sequelize.query(query, {
      replacements: { puerto, desde: desdeIso, limite },
      type: QueryTypes.SELECT
    });
  }

  async obtenerResumenPorTipoCarga(puerto) {
    const query = `
            SELECT
                ISNULL(tipo_carga_principal, 'Carga General') AS tipo_carga,
                CAST(SUM(inventario_actual_ton) AS FLOAT) AS total_toneladas,
                CAST(SUM(capacidad_maxima_ton) AS FLOAT) AS capacidad_toneladas,
                COUNT(id_bodega) AS cantidad_bodegas
            FROM dbo.TCL_MaestroBodegas WITH (NOLOCK)
            WHERE UPPER(LTRIM(RTRIM(id_puerto))) = :puerto
              AND activo = 1
            GROUP BY ISNULL(tipo_carga_principal, 'Carga General')
            ORDER BY total_toneladas DESC;
        `;

    return await sequelize.query(query, {
      replacements: { puerto },
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
}

module.exports = new BodegasRepository();
module.exports.Bodega = Bodega;
module.exports.MovimientoBodega = MovimientoBodega;