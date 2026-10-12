/*
    Author: German Valencia
    Repository: Bodegas y Silos - Consultas SQL Aisladas (Sequelize QueryTypes)
*/
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../../database/connection');

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
                         ELSE 0
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
}

module.exports = new BodegasRepository();