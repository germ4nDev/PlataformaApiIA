/*
    Author: German Valencia
    Layer: Repository (Data Access Layer - SQL Server)
    Module: Torre de Control - Virtual Gate (TCL_VIRTUAL_GATE_001)
*/
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../../database/connection');

class VirtualGateRepository {
  /**
   * Detecta cuál tabla de citas existe en la BD (dbo.TCL_CitasVirtualGate o dbo.TCL_CitasGate)
   */
  async resolverTablaCitas() {
    const sql = `
            SELECT 
                CASE 
                    WHEN OBJECT_ID('dbo.TCL_CitasVirtualGate', 'U') IS NOT NULL THEN 'dbo.TCL_CitasVirtualGate'
                    WHEN OBJECT_ID('dbo.TCL_CitasGate', 'U') IS NOT NULL THEN 'dbo.TCL_CitasGate'
                    ELSE NULL
                END AS tablaActiva;
        `;
    const [res] = await sequelize.query(sql, { type: QueryTypes.SELECT });
    return res?.tablaActiva || null;
  }

  /**
   * 1. Obtiene el listado completo de camiones en cola / enturnamiento para el puerto
   */
  async obtenerCitasPorPuerto(puerto) {
    const tabla = await this.resolverTablaCitas();
    if (!tabla) return [];

    const sql = `
            SELECT
                c.*
            FROM ${tabla} c WITH (NOLOCK)
            WHERE UPPER(LTRIM(RTRIM(ISNULL(c.id_puerto, c.puerto)))) = :puerto
            ORDER BY 
                CASE 
                    WHEN c.estado IN ('EN_PUERTO', 'PRE_GATE', 'VALIDADO', 'LLAMADO') THEN 1
                    WHEN c.estado IN ('EN_COLA', 'ENTURNADO', 'EN_RUTA') THEN 2
                    ELSE 3
                END,
                c.id ASC;
        `;

    return await sequelize.query(sql, {
      replacements: { puerto: String(puerto || 'BUENAVENTURA').trim().toUpperCase() },
      type: QueryTypes.SELECT
    });
  }

  /**
   * 2. Obtiene la saturación promedio de bodegas del puerto (para el KPI PTT_GATE_KPI_BODEGAS)
   */
  async obtenerSaturacionBodegasPuerto(puerto) {
    const sql = `
            IF OBJECT_ID('dbo.TCL_MaestroBodegas', 'U') IS NOT NULL
            BEGIN
                SELECT 
                    CAST(
                        ISNULL(
                            ROUND(
                                AVG(
                                    CASE 
                                        WHEN ISNULL(capacidad_maxima, 0) > 0 
                                        THEN (CAST(ocupacion_actual AS FLOAT) / CAST(capacidad_maxima AS FLOAT)) * 100.0
                                        ELSE 0 
                                    END
                                ), 1
                            ), 0
                        ) AS DECIMAL(5,1)
                    ) AS saturacionPromedio,
                    COUNT(1) AS totalBodegas
                FROM dbo.TCL_MaestroBodegas WITH (NOLOCK)
                WHERE UPPER(LTRIM(RTRIM(id_puerto))) = :puerto;
            END
            ELSE
            BEGIN
                SELECT CAST(0 AS DECIMAL(5,1)) AS saturacionPromedio, 0 AS totalBodegas;
            END
        `;

    const [fila] = await sequelize.query(sql, {
      replacements: { puerto: String(puerto || 'BUENAVENTURA').trim().toUpperCase() },
      type: QueryTypes.SELECT
    });

    return fila || { saturacionPromedio: 0, totalBodegas: 0 };
  }
}

module.exports = new VirtualGateRepository();