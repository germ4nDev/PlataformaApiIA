/*
    Author: German Valencia
    Pattern: QPLUS Service Pattern - Lógica RNDC
*/
const { db } = require('../../database/connection');
const { QueryTypes } = require('sequelize');

class RndcBatchService {
  async ejecutarCalculoLeyLittle() {
    try {
      const sqlQuery = `
                WITH bv_rndc AS (
                    SELECT
                        viajestotales AS viajes,
                        CASE
                            WHEN UPPER(mercancia) LIKE '%CONTENEDOR%'        THEN 'CONTENEDOR'
                            WHEN UPPER(mercancia) LIKE '%MAIZ%'
                              OR UPPER(mercancia) LIKE '%TRIGO%'
                              OR UPPER(mercancia) LIKE '%CEBADA%'
                              OR UPPER(mercancia) LIKE '%SORGO%'
                              OR UPPER(mercancia) LIKE '%SOYA%'
                              OR UPPER(mercancia) LIKE '%FERTILIZANT%'
                              OR UPPER(mercancia) LIKE '%ABONO%'
                              OR UPPER(mercancia) LIKE '%CLINKER%'
                              OR UPPER(mercancia) LIKE '%MINERAL%'           THEN 'GRANEL'
                            WHEN UPPER(mercancia) LIKE '%VEHIC%'
                              OR UPPER(mercancia) LIKE '%AUTOMOV%'
                              OR UPPER(mercancia) LIKE '%COCHE%'             THEN 'VEHICULO'
                            ELSE 'CARGA GENERAL / SUELTA'
                        END                                                  AS tipo_carga
                    FROM TCLRndcRaw
                    WHERE UPPER(municipiodestino) LIKE '%BUENAVENTURA%'
                       OR UPPER(municipioorigen)  LIKE '%BUENAVENTURA%'
                )
                SELECT
                    tipo_carga,
                    SUM(viajes)                                            AS viajes_periodo,
                    ROUND(SUM(viajes) / 120.0, 0)                          AS viajes_dia,
                    ROUND(SUM(viajes) / 120.0 * 0.656, 0)                  AS camiones_en_operacion
                FROM bv_rndc
                GROUP BY tipo_carga
                ORDER BY camiones_en_operacion DESC;
            `;

      // Ejecutamos la consulta pura directamente en SQL Server
      const resultadosAgrupados = await db.sequelize.query(sqlQuery, {
        type: QueryTypes.SELECT
      });

      // console.log(`[CRON] Cálculo procesado en DB. Se obtuvieron ${resultadosAgrupados.length} categorías.`);

      // Preparamos el DTO masivo para guardar el histórico del día
      const registrosParaGuardar = resultadosAgrupados.map(fila => ({
        // Asumimos que tienes un modelo TCLReporteRNDC para persistir el KPI
        codigoReporte: require('uuid').v4(),
        tipoCarga: fila.tipo_carga,
        viajesPeriodo: fila.viajes_periodo,
        camionesOperacion: fila.camiones_en_operacion,
        fechaCorte: new Date(),
        codigoUsuarioCreacion: 'SISTEMA_CRON_RNDC'
      }));

      // Insertamos el consolidado resultante (apenas 4 filas) en la tabla final
      await db.TCLReporteRNDC.bulkCreate(registrosParaGuardar);

      // console.log('[SERVICE] KPI "Camiones en Operación" actualizado y persistido.');
      return true;
    } catch (error) {
      // console.error('[SERVICE] Fallo crítico durante la agregación in-DB:', error);
      throw error;
    }
  }
}

module.exports = new RndcBatchService();