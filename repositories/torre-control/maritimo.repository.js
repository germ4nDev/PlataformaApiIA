/*
    Author: German Valencia
    Pattern: PORTTOS Repository Pattern - Marítimo Maestro
    Standard: Esquema normalizado dbo.TCL_* y dbo.T_Maestro_* (100% SQL Real)
*/
const { QueryTypes } = require('sequelize');
const { db } = require('../../database/connection');

/** Fechas del line-up (texto): ISO con o sin Z, o dd/mm/aaaa. NULL si no se puede leer. */
const FECHA_LINEUP = (col) =>
  `COALESCE(TRY_CONVERT(DATETIME, ${col}, 127), TRY_CAST(${col} AS DATETIME), TRY_CONVERT(DATETIME, ${col}, 103))`;

class MaritimoRepository {

  /**
   * 1. Viajes terrestres desde dbo.TCL_RNDCOperacionTerrestre
   */
  async getKpisOperativos(ciudadKey) {
    const puertoParam = `%${(ciudadKey || '').trim()}%`;

    const query = `
      SELECT COALESCE(SUM(TRY_CAST(viajesTotales AS FLOAT)), 0) AS viajes
      FROM dbo.TCL_RNDCOperacionTerrestre
      WHERE UPPER(municipioDestino) LIKE UPPER(:puerto)
         OR UPPER(municipioOrigen)  LIKE UPPER(:puerto)
    `;

    const result = await db.sequelize.query(query, {
      replacements: { puerto: puertoParam },
      type: QueryTypes.SELECT,
      plain: true
    });

    return result || { viajes: 0 };
  }

  /**
   * 2. Volumen operativo por tipo de carga:
   * Prioriza la nueva tabla dbo.TCL_HistoricoProductividad y respalda con dbo.TCL_LineUpMaritimo + dbo.TCL_MaestroNodosLogisticos
   */
  async getCargasLineUp(ciudadKey) {
    const filtro = `%${(ciudadKey || '').trim()}%`;

    try {
      const sqlHist = `
        SELECT 
          UPPER(COALESCE(NULLIF(TRIM(tipo_carga), ''), 'GENERAL')) AS tipoCarga,
          'OPERACION' AS operacionActual,
          COUNT(*) AS cantidadBuques,
          SUM(
            COALESCE(TRY_CAST(toneladas_movilizadas AS FLOAT), 0) +
            COALESCE(TRY_CAST(teus_movilizados AS FLOAT), 0) +
            COALESCE(TRY_CAST(vehiculos_movilizados AS FLOAT), 0)
          ) AS volumenTotal
        FROM dbo.TCL_HistoricoProductividad
        WHERE UPPER(COALESCE(puerto, id_terminal, '')) LIKE UPPER(:puerto)
        GROUP BY UPPER(COALESCE(NULLIF(TRIM(tipo_carga), ''), 'GENERAL'))
      `;
      const resHist = await db.sequelize.query(sqlHist, {
        replacements: { puerto: filtro },
        type: QueryTypes.SELECT
      });
      if (Array.isArray(resHist) && resHist.length > 0) {
        return resHist;
      }
    } catch (_) {
      // Continúa al cruce de LineUp + NodosLogisticos si no hay registros
    }

    try {
      const query = `
        SELECT 
          UPPER(COALESCE(NULLIF(TRIM(O.tipoNodo), ''), NULLIF(TRIM(L.trabajoOperacion), ''), 'GENERAL')) AS tipoCarga,
          UPPER(COALESCE(NULLIF(TRIM(L.trabajoOperacion), ''), NULLIF(TRIM(L.posicion), ''), 'DESCARGA')) AS operacionActual,
          COUNT(L.motonave) AS cantidadBuques,
          SUM(COALESCE(TRY_CAST(O.ocupacionActual AS FLOAT), 0)) AS volumenTotal
        FROM dbo.TCL_LineUpMaritimo L
        LEFT JOIN dbo.TCL_MaestroNodosLogisticos O
          ON UPPER(TRIM(L.motonave)) = UPPER(TRIM(O.nombreNodo))
        WHERE UPPER(L.puerto) LIKE UPPER(:puerto)
          AND COALESCE(L.estadoRegistro, 1) = 1
        GROUP BY 
          UPPER(COALESCE(NULLIF(TRIM(O.tipoNodo), ''), NULLIF(TRIM(L.trabajoOperacion), ''), 'GENERAL')),
          UPPER(COALESCE(NULLIF(TRIM(L.trabajoOperacion), ''), NULLIF(TRIM(L.posicion), ''), 'DESCARGA'))
      `;

      return await db.sequelize.query(query, {
        replacements: { puerto: filtro },
        type: QueryTypes.SELECT
      });
    } catch (error) {
      console.error('❌ [MaritimoRepository.getCargasLineUp] Error SQL:', error.message);
      return [];
    }
  }

  /**
   * 3. KPIs Terrestres desde dbo.TCL_RNDCOperacionTerrestre
   */
  async getKpisTerrestres(anio, mes) {
    const query = `
      SELECT 
        COALESCE(SUM(TRY_CAST(viajesTotales AS FLOAT)), 0) AS v, 
        COALESCE(SUM(TRY_CAST(kilogramos AS FLOAT)), 0) AS c, 
        COALESCE(SUM(TRY_CAST(valoresPagados AS FLOAT)), 0) AS f, 
        COALESCE(SUM(TRY_CAST(galones AS FLOAT)), 0) AS g 
      FROM dbo.TCL_RNDCOperacionTerrestre 
      WHERE YEAR(TRY_CAST(fechaInicioPeriodo AS DATETIME)) = :anio 
        AND MONTH(TRY_CAST(fechaInicioPeriodo AS DATETIME)) = :mes
    `;
    return await db.sequelize.query(query, {
      replacements: { anio, mes },
      type: QueryTypes.SELECT
    });
  }

  /**
   * 4. KPIs Marítimos desde dbo.TCL_LineUpMaritimo + dbo.TCL_MaestroNodosLogisticos
   */
  async getKpisMaritimos(ciudadKey) {
    const query = `
      SELECT 
        COUNT(DISTINCT L.motonave) AS n,
        COALESCE(SUM(TRY_CAST(O.ocupacionActual AS FLOAT)), 0) AS c
      FROM dbo.TCL_LineUpMaritimo L
      LEFT JOIN dbo.TCL_MaestroNodosLogisticos O
        ON UPPER(TRIM(L.motonave)) = UPPER(TRIM(O.nombreNodo))
      WHERE UPPER(L.puerto) LIKE UPPER(:puerto)
        AND COALESCE(L.estadoRegistro, 1) = 1
    `;
    return await db.sequelize.query(query, {
      replacements: { puerto: `%${(ciudadKey || '').trim()}%` },
      type: QueryTypes.SELECT
    });
  }

  /**
   * 5. Alertas Viales desde dbo.TCL_EventosViales
   */
  async getAlertasViales() {
    // Misma regla que el mapa: solo los eventos vigentes (antes contaba todo lo ACTIVO
    // de la tabla, que nunca se desactiva). Mismo formato de respuesta: [{ a }].
    const a = await require('./eventos-viales.repository').contarVigentes();
    return [{ a }];
  }

  /**
   * 6. Estado de Terminales y Muelles desde dbo.TCL_LineUpMaritimo + dbo.TCL_MaestroNodosLogisticos
   */
  async getTerminalesLineUp(ciudadKey) {
    const sql = `
      SELECT 
        L.terminal AS codigoTerminal, 
        L.muelle, 
        L.motonave AS barco, 
        L.posicion AS estado_posicion,
        L.trabajoOperacion AS tipo_trabajo,
        L.eslora,
        COALESCE(TRY_CAST(O.ocupacionActual AS FLOAT), 0) AS cantidadMovida,
        L.fechaAtraque,
        L.fechaZarpe
      FROM dbo.TCL_LineUpMaritimo L
      LEFT JOIN dbo.TCL_MaestroNodosLogisticos O
        ON UPPER(TRIM(L.motonave)) = UPPER(TRIM(O.nombreNodo))
      WHERE UPPER(L.puerto) LIKE UPPER(:puerto) 
        AND COALESCE(L.estadoRegistro, 1) = 1
        -- Tiempo real por estado, no por fecha: el barco ya atracó y todavía no zarpa.
        AND (
              ${FECHA_LINEUP('L.fechaAtraque')} <= GETDATE()
           OR (NULLIF(LTRIM(RTRIM(L.fechaAtraque)), '') IS NULL
               AND (UPPER(L.posicion) LIKE '%ATRAC%' OR UPPER(L.trabajoOperacion) LIKE '%CARGA%'))
        )
        AND (NULLIF(LTRIM(RTRIM(L.fechaZarpe)), '') IS NULL OR ${FECHA_LINEUP('L.fechaZarpe')} > GETDATE())
      ORDER BY ${FECHA_LINEUP('L.fechaAtraque')} DESC
    `;
    return await db.sequelize.query(sql, {
      replacements: { puerto: `%${(ciudadKey || '').trim()}%` },
      type: QueryTypes.SELECT
    });
  }

  /**
   * 7. Desviación ETA vs ATA desde dbo.TCL_LineUpMaritimo
   */
  async getGraficaEtaAta(ciudadKey) {
    const sql = `
      SELECT 
        terminal, 
        AVG(CAST(DATEDIFF(hour, TRY_CAST(eta AS DATETIME), TRY_CAST(fechaAtraque AS DATETIME)) AS FLOAT)) AS retrasoPromedio
      FROM dbo.TCL_LineUpMaritimo
      WHERE fechaAtraque IS NOT NULL 
        AND eta IS NOT NULL
        AND puerto IS NOT NULL
        AND UPPER(puerto) LIKE UPPER(:puerto)
        AND ABS(DATEDIFF(hour, TRY_CAST(eta AS DATETIME), TRY_CAST(fechaAtraque AS DATETIME))) < 720
      GROUP BY terminal
    `;

    return await db.sequelize.query(sql, {
      replacements: { puerto: `%${(ciudadKey || '').trim()}%` },
      type: QueryTypes.SELECT
    });
  }

  /**
   * 8. Pronóstico de Motonaves cruzando dbo.TCL_LineUpMaritimo, dbo.TCL_MaestroNodosLogisticos,
   * dbo.TCL_NavesArribadas y dbo.TCL_NavesAvisadas
   */
  async getPronosticoMotonaves(ciudadKey) {
    try {
      const sql = `
        WITH DimarAgencias AS (
          SELECT UPPER(TRIM(motonave)) AS motonave_key, MAX(agencia) AS agencia
          FROM (
            SELECT motonave, agencia FROM dbo.TCL_NavesArribadas WHERE motonave IS NOT NULL
            UNION ALL
            SELECT motonave, agencia FROM dbo.TCL_NavesAvisadas WHERE motonave IS NOT NULL
          ) D
          GROUP BY UPPER(TRIM(motonave))
        )
        SELECT 
          L.motonave AS nombreMotonave, 
          L.terminal, 
          COALESCE(L.trabajoOperacion, L.posicion, 'EN TRÁNSITO') AS estadoOperacion, 
          L.eta AS fechaETA,
          L.fechaAtraque AS fechaATA,
          L.muelle AS muelleAsignado,
          COALESCE(DA.agencia, 'NO REPORTADA') AS agenciaNaviera,
          COALESCE(TRY_CAST(O.ocupacionActual AS FLOAT), 0) AS cantidadMovida,
          COALESCE(O.tipoNodo, L.trabajoOperacion, 'GENERAL') AS tipoCarga,
          COALESCE(O.estadoOperativo, L.posicion, 'EN TRÁNSITO') AS estadoReal,
          L.lineaAgencia, L.viaje, L.eslora, L.fechaZarpe, L.novedades
        FROM dbo.TCL_LineUpMaritimo L
        LEFT JOIN dbo.TCL_MaestroNodosLogisticos O 
          ON UPPER(TRIM(L.motonave)) = UPPER(TRIM(O.nombreNodo))
        LEFT JOIN DimarAgencias DA
          ON UPPER(TRIM(L.motonave)) = DA.motonave_key
        WHERE UPPER(L.puerto) LIKE UPPER(:puerto)
          AND COALESCE(L.estadoRegistro, 1) = 1
      `;

      const resultados = await db.sequelize.query(sql, {
        replacements: { puerto: `%${(ciudadKey || '').trim()}%` },
        type: QueryTypes.SELECT
      });

      return resultados || [];
    } catch (error) {
      console.error('❌ [MaritimoRepository.getPronosticoMotonaves] Error SQL:', error.message);
      return [];
    }
  }

  /**
   * 9. Toneladas Movidas por Terminal y Tipo de Carga desde la nueva tabla dbo.TCL_HistoricoProductividad
   */
  async getGraficaToneladas(ciudadKey) {
    const filtro = `%${(ciudadKey || '').trim()}%`;

    try {
      const sqlHistorico = `
        SELECT 
          UPPER(TRIM(id_terminal)) AS codigoTerminal,
          UPPER(COALESCE(NULLIF(TRIM(tipo_carga), ''), 'GENERAL')) AS tipoCarga,
          SUM(
            COALESCE(TRY_CAST(toneladas_movilizadas AS FLOAT), 0) +
            COALESCE(TRY_CAST(teus_movilizados AS FLOAT), 0)
          ) AS totalVolumen
        FROM dbo.TCL_HistoricoProductividad
        WHERE UPPER(COALESCE(puerto, id_terminal, '')) LIKE UPPER(:puerto)
        GROUP BY 
          UPPER(TRIM(id_terminal)),
          UPPER(COALESCE(NULLIF(TRIM(tipo_carga), ''), 'GENERAL'))
      `;
      const resHist = await db.sequelize.query(sqlHistorico, {
        replacements: { puerto: filtro },
        type: QueryTypes.SELECT
      });
      if (Array.isArray(resHist) && resHist.length > 0) {
        return resHist;
      }
    } catch (_) {
      // Fallback a TCL_LineUpMaritimo + TCL_NodosLogisticos
    }

    try {
      const sqlLineUp = `
        SELECT 
          L.terminal AS codigoTerminal,
          UPPER(COALESCE(NULLIF(TRIM(O.tipoNodo), ''), NULLIF(TRIM(L.trabajoOperacion), ''), 'GENERAL')) AS tipoCarga,
          SUM(COALESCE(TRY_CAST(O.ocupacionActual AS FLOAT), 0)) AS totalVolumen
        FROM dbo.TCL_LineUpMaritimo L
        LEFT JOIN dbo.TCL_MaestroNodosLogisticos O
          ON UPPER(TRIM(L.motonave)) = UPPER(TRIM(O.nombreNodo))
        WHERE UPPER(L.puerto) LIKE UPPER(:puerto)
          AND L.terminal IS NOT NULL
        GROUP BY 
          L.terminal,
          UPPER(COALESCE(NULLIF(TRIM(O.tipoNodo), ''), NULLIF(TRIM(L.trabajoOperacion), ''), 'GENERAL'))
      `;
      return await db.sequelize.query(sqlLineUp, {
        replacements: { puerto: filtro },
        type: QueryTypes.SELECT
      });
    } catch (error) {
      console.error('❌ [MaritimoRepository.getGraficaToneladas] Error SQL:', error.message);
      return [];
    }
  }

  /**
   * 10. Tráfico Portuario Marítimo desde la nueva tabla dbo.TCL_TraficoPortuarioMaritimo
   * (Aprovecha id_puerto, id_terminal y la columna calculada totalToneladas)
   */
  async getTraficoPortuarioSQL(ciudadKey) {
    try {
      const sql = `
        SELECT 
          traficoMaritimoId,
          anioVigencia,
          mesVigencia,
          id_puerto,
          zonaPortuaria,
          id_terminal,
          sociedadPortuaria,
          tipoCarga,
          COALESCE(TRY_CAST(exportacion AS FLOAT), 0) AS exportacion,
          COALESCE(TRY_CAST(importacion AS FLOAT), 0) AS importacion,
          COALESCE(TRY_CAST(transbordo AS FLOAT), 0) AS transbordo,
          COALESCE(TRY_CAST(transitoInternacional AS FLOAT), 0) AS transitoInternacional,
          COALESCE(TRY_CAST(fluvial AS FLOAT), 0) AS fluvial,
          COALESCE(TRY_CAST(cabotaje AS FLOAT), 0) AS cabotaje,
          COALESCE(TRY_CAST(movilizacionesABordo AS FLOAT), 0) AS movilizacionesABordo,
          COALESCE(TRY_CAST(transitoria AS FLOAT), 0) AS transitoria,
          COALESCE(TRY_CAST(totalToneladas AS FLOAT), 0) AS totalToneladas
        FROM dbo.TCL_TraficoPortuarioMaritimo
        WHERE UPPER(COALESCE(zonaPortuaria, '')) LIKE UPPER(:puerto)
      `;
      return await db.sequelize.query(sql, {
        replacements: { puerto: `%${(ciudadKey || '').trim()}%` },
        type: QueryTypes.SELECT
      });
    } catch (error) {
      console.error('❌ [MaritimoRepository.getTraficoPortuarioSQL] Error SQL:', error.message);
      return [];
    }
  }

  /**
   * 11. Ranking Nacional de Puertos usando la columna calculada totalToneladas de dbo.TCL_TraficoPortuarioMaritimo
   */
  async getRankingNacionalPuertosSQL() {
    try {
      const sql = `
        WITH MaxAnio AS (
          SELECT MAX(anioVigencia) AS anio FROM dbo.TCL_TraficoPortuarioMaritimo
        )
        SELECT 
          UPPER(TRIM(zonaPortuaria)) AS zonaPortuaria,
          SUM(
            COALESCE(
              TRY_CAST(totalToneladas AS FLOAT),
              COALESCE(TRY_CAST(exportacion AS FLOAT), 0) +
              COALESCE(TRY_CAST(importacion AS FLOAT), 0) +
              COALESCE(TRY_CAST(transbordo AS FLOAT), 0) +
              COALESCE(TRY_CAST(cabotaje AS FLOAT), 0) +
              COALESCE(TRY_CAST(fluvial AS FLOAT), 0)
            )
          ) AS totalToneladas
        FROM dbo.TCL_TraficoPortuarioMaritimo
        WHERE anioVigencia = (SELECT anio FROM MaxAnio)
        GROUP BY UPPER(TRIM(zonaPortuaria))
        ORDER BY totalToneladas DESC
      `;
      return await db.sequelize.query(sql, { type: QueryTypes.SELECT });
    } catch (_) {
      return [];
    }
  }

  /**
   * 12. Saturación de Bodegas desde la tabla renombrada dbo.TCL_MaestroBodegas (antes TCLNodosMonitoreo)
   */
  async getResumenSaturacionBodegasSQL(ciudadKey) {
    try {
      const sql = `
        SELECT 
          COUNT(*) AS totalBodegas,
          SUM(COALESCE(TRY_CAST(ocupacionActual AS FLOAT), 0)) AS inventarioTotal,
          SUM(COALESCE(TRY_CAST(capacidadMaxima AS FLOAT), 0)) AS capacidadTotal,
          SUM(CASE 
            WHEN COALESCE(TRY_CAST(capacidadMaxima AS FLOAT), 0) > 0 
             AND (COALESCE(TRY_CAST(ocupacionActual AS FLOAT), 0) / TRY_CAST(capacidadMaxima AS FLOAT)) >= 0.85 
            THEN 1 ELSE 0 END
          ) AS bodegasCriticas
        FROM dbo.TCL_MaestroBodegas
        WHERE UPPER(COALESCE(puerto, ubicacion, '')) LIKE UPPER(:puerto)
      `;
      const res = await db.sequelize.query(sql, {
        replacements: { puerto: `%${(ciudadKey || '').trim()}%` },
        type: QueryTypes.SELECT,
        plain: true
      });
      return res || null;
    } catch (_) {
      return null;
    }
  }

  async getPeriodoMasReciente() {
    return await db.sequelize.query(
      `SELECT TOP 1 
         YEAR(TRY_CAST(fechaInicioPeriodo AS DATETIME)) AS anio, 
         MONTH(TRY_CAST(fechaInicioPeriodo AS DATETIME)) AS mes 
       FROM dbo.TCL_RNDCOperacionTerrestre 
       WHERE TRY_CAST(fechaInicioPeriodo AS DATETIME) IS NOT NULL
       ORDER BY TRY_CAST(fechaInicioPeriodo AS DATETIME) DESC`,
      { type: QueryTypes.SELECT }
    );
  }

  async getUltimoPeriodo() {
    const query = `
      SELECT MAX(TRY_CAST(fechaInicioPeriodo AS DATETIME)) AS ultimaFecha 
      FROM dbo.TCL_RNDCOperacionTerrestre
    `;
    const result = await db.sequelize.query(query, { type: QueryTypes.SELECT });
    return result?.[0]?.ultimaFecha || null;
  }

  async getMapaPortuarioJerarquia() {
    const sql = `
      SELECT 
        p.id_puerto, 
        p.nombre AS puerto_nombre, 
        p.region, 
        p.ubicacion_geo.STAsText() AS ubicacion_wkt, 
        p.geocerca_geo.STAsText() AS puerto_wkt, 
        t.id_terminal, 
        t.nombre AS terminal_nombre, 
        t.subtitulo, 
        t.descripcion, 
        t.unidad_medida, 
        t.capacidad_reefer,
        t.geocerca_geo.STAsText() AS terminal_wkt,
        m.codigo_muelle, 
        m.db_id_origen, 
        m.especialidad, 
        m.calado_metros, 
        m.estado_mantenimiento,
        m.geocerca_geo.STAsText() AS muelle_wkt
      FROM dbo.TCL_MaestroPuertos p
      LEFT JOIN dbo.TCL_MaestroTerminales t ON p.id_puerto = t.id_puerto
      LEFT JOIN dbo.TCL_MaestroMuelles m ON t.id_terminal = m.id_terminal
      ORDER BY p.nombre, t.id_terminal, m.codigo_muelle
    `;

    return await db.sequelize.query(sql, { type: QueryTypes.SELECT });
  }

  /**
   * 13. Resumen Semanal Marítimo:
   * Combina el conteo de motonaves en dbo.TCL_LineUpMaritimo con los volúmenes de dbo.TCL_HistoricoProductividad
   */
  async getResumenSemanalMaritimo(ciudadKey) {
    const filtro = `%${(ciudadKey || '').trim()}%`;

    try {
      const sql = `
        SELECT 
          (SELECT COUNT(DISTINCT motonave) FROM dbo.TCL_LineUpMaritimo WHERE UPPER(puerto) LIKE UPPER(:puerto)) AS totalMotonaves,
          COALESCE(SUM(TRY_CAST(teus_movilizados AS FLOAT)), 0) AS totalTeus,
          COALESCE(SUM(CASE 
            WHEN UPPER(COALESCE(tipo_carga, '')) LIKE '%GRANEL%' 
              OR UPPER(COALESCE(tipo_carga, '')) LIKE '%AGRICOLA%' 
              OR UPPER(COALESCE(tipo_carga, '')) LIKE '%MINERAL%' 
              OR UPPER(COALESCE(tipo_carga, '')) LIKE '%LIQUIDO%'
            THEN COALESCE(TRY_CAST(toneladas_movilizadas AS FLOAT), 0) ELSE 0 END), 0) AS totalGranel,
          COALESCE(SUM(TRY_CAST(vehiculos_movilizados AS FLOAT)), 0) AS totalVehiculos
        FROM dbo.TCL_HistoricoProductividad
        WHERE UPPER(COALESCE(puerto, id_terminal, '')) LIKE UPPER(:puerto)
      `;

      const resultados = await db.sequelize.query(sql, {
        replacements: { puerto: filtro },
        type: QueryTypes.SELECT
      });

      const totales = resultados[0] || {};
      const teus = parseFloat(totales.totalTeus) || 0;
      const granel = parseFloat(totales.totalGranel) || 0;

      // Si TCL_HistoricoProductividad tiene datos, los retornamos
      if (teus > 0 || granel > 0) {
        return [
          {
            totalMotonaves: parseInt(totales.totalMotonaves) || 0,
            totalTeus: teus,
            totalGranel: granel,
            totalVehiculos: parseFloat(totales.totalVehiculos) || 0
          }
        ];
      }

      // Fallback sobre TCL_LineUpMaritimo + TCL_NodosLogisticos
      const sqlFallback = `
        SELECT 
          COUNT(DISTINCT L.motonave) AS totalMotonaves,
          SUM(CASE WHEN UPPER(COALESCE(O.tipoNodo, '')) LIKE '%CONTENEDOR%' OR UPPER(COALESCE(O.tipoNodo, '')) LIKE '%FCL%' 
              THEN COALESCE(TRY_CAST(O.ocupacionActual AS FLOAT), 0) ELSE 0 END) AS totalTeus,
          SUM(CASE WHEN UPPER(COALESCE(O.tipoNodo, '')) LIKE '%AGRICOLA%' OR UPPER(COALESCE(O.tipoNodo, '')) LIKE '%MINERAL%' OR UPPER(COALESCE(O.tipoNodo, '')) LIKE '%GRANEL%' 
              THEN COALESCE(TRY_CAST(O.ocupacionActual AS FLOAT), 0) ELSE 0 END) AS totalGranel,
          SUM(CASE WHEN UPPER(COALESCE(O.tipoNodo, '')) LIKE '%VEHICULO%' OR UPPER(COALESCE(O.tipoNodo, '')) LIKE '%RO-RO%' 
              THEN COALESCE(TRY_CAST(O.ocupacionActual AS FLOAT), 0) ELSE 0 END) AS totalVehiculos
        FROM dbo.TCL_LineUpMaritimo L
        LEFT JOIN dbo.TCL_MaestroNodosLogisticos O 
          ON UPPER(TRIM(L.motonave)) = UPPER(TRIM(O.nombreNodo))
        WHERE UPPER(L.puerto) LIKE UPPER(:puerto)
      `;

      const resFallback = await db.sequelize.query(sqlFallback, {
        replacements: { puerto: filtro },
        type: QueryTypes.SELECT
      });
      const fb = resFallback[0] || {};
      return [
        {
          totalMotonaves: parseInt(fb.totalMotonaves) || 0,
          totalTeus: parseFloat(fb.totalTeus) || 0,
          totalGranel: parseFloat(fb.totalGranel) || 0,
          totalVehiculos: parseFloat(fb.totalVehiculos) || 0
        }
      ];
    } catch (error) {
      throw error;
    }
  }

  /**
   * 14. Reportes Operativos desde dbo.TCL_ReportesOperativos
   */
  async getReportesOperativos(ciudadKey) {
    try {
      const sql = `
        SELECT TOP 5 
          id_reporte, 
          titulo, 
          descripcion, 
          fecha_evento AS etiquetaTiempo, 
          tipo_color AS colorLinea
        FROM dbo.TCL_ReportesOperativos
        WHERE UPPER(puerto) = UPPER(:puerto)
        ORDER BY id_reporte DESC
      `;

      const resultados = await db.sequelize.query(sql, {
        replacements: { puerto: ciudadKey },
        type: QueryTypes.SELECT
      });

      return resultados || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * 15. Productividad Intradiaria desde dbo.TCL_ProductividadTerminales
   */
  async getProductividadIntradiaria(puertoKey) {
    try {
      const sql = `
        SELECT terminal, hora_etiqueta, movimientos_hora 
        FROM dbo.TCL_ProductividadTerminales
        WHERE UPPER(puerto) = UPPER(:puerto)
          AND fecha = (
            SELECT MAX(fecha) 
            FROM dbo.TCL_ProductividadTerminales 
            WHERE UPPER(puerto) = UPPER(:puerto)
          )
        ORDER BY hora_etiqueta ASC
      `;

      const resultados = await db.sequelize.query(sql, {
        replacements: { puerto: puertoKey },
        type: QueryTypes.SELECT
      });

      return resultados || [];
    } catch (error) {
      return [];
    }
  }

  async upsertProductividadMasiva(registrosDTO) {
    const transaction = await db.sequelize.transaction();

    try {
      for (const dto of registrosDTO) {
        const sql = `
          IF EXISTS (
            SELECT 1 FROM dbo.TCL_ProductividadTerminales 
            WHERE puerto = :puerto AND terminal = :terminal 
              AND fecha = :fecha AND hora_etiqueta = :horaEtiqueta
          )
            UPDATE dbo.TCL_ProductividadTerminales 
            SET movimientos_hora = :movimientosHora, 
                fechaModificacion = :fechaModificacion, 
                codigoUsuarioModificacion = :codigoUsuarioModificacion
            WHERE puerto = :puerto AND terminal = :terminal 
              AND fecha = :fecha AND hora_etiqueta = :horaEtiqueta
          ELSE
            INSERT INTO dbo.TCL_ProductividadTerminales 
              (puerto, terminal, fecha, hora_etiqueta, movimientos_hora, codigoUsuarioCreacion, fechaCreacion)
            VALUES 
              (:puerto, :terminal, :fecha, :horaEtiqueta, :movimientosHora, :codigoUsuarioCreacion, :fechaCreacion)
        `;

        await db.sequelize.query(sql, { replacements: dto, transaction });
      }

      await transaction.commit();
      return registrosDTO.length;
    } catch (error) {
      await transaction.rollback();
      const mensajeReal = error.parent ? error.parent.message : error.message;
      throw new Error(mensajeReal);
    }
  }

  /**
   * 16. Naves Avisadas desde dbo.TCL_NavesAvisadas
   */
  async getMotonavesAvisadasParaRastreo() {
    try {
      const sql = `
        SELECT DISTINCT 
          UPPER(TRIM(motonave)) AS motonave, 
          omi 
        FROM dbo.TCL_NavesAvisadas 
        WHERE fecha_cargue >= DATEADD(day, -7, GETDATE())
      `;
      return await db.sequelize.query(sql, { type: QueryTypes.SELECT });
    } catch (error) {
      return [];
    }
  }

  async getBoundingBoxesActivos() {
    try {
      const sql = `
        SELECT 
          nombre,
          geocerca_geo.STEnvelope().STPointN(1).STY AS bbox_lat_sur,
        geocerca_geo.STEnvelope().STPointN(1).STX AS bbox_lon_oeste,
        geocerca_geo.STEnvelope().STPointN(3).STY AS bbox_lat_norte,
        geocerca_geo.STEnvelope().STPointN(3).STX AS bbox_lon_este 
        FROM dbo.TCL_MaestroPuertos 
        WHERE geocerca_geo IS NOT NULL
      `;

      const puertos = await db.sequelize.query(sql, { type: QueryTypes.SELECT });

      return puertos.map((p) => [
        [parseFloat(p.bbox_lat_sur), parseFloat(p.bbox_lon_oeste)],
        [parseFloat(p.bbox_lat_norte), parseFloat(p.bbox_lon_este)]
      ]);
    } catch (error) {
      return [];
    }
  }

  /**
   * 17. Telemetría AIS en dbo.TCL_AisUltimaPosicion
   */
  async guardarUltimaPosicionAIS(dtoData) {
    if (!dtoData || !dtoData.mmsi) {
      return;
    }

    try {
      const dataSegura = {
        mmsi: dtoData.mmsi,
        imo: dtoData.omi || null,
        nombre_motonave: (dtoData.nombre_motonave || 'DESCONOCIDO').substring(0, 50),
        latitud: parseFloat(dtoData.lat || dtoData.latitud) || 0,
        longitud: parseFloat(dtoData.lon || dtoData.longitud) || 0,
        velocidad: parseFloat(dtoData.velocidad) || 0,
        rumbo: parseFloat(dtoData.rumbo) || 0,
        destino: (dtoData.destino || 'SIN DESTINO').substring(0, 50),
        estado_inferido: (dtoData.estadoInferido || dtoData.estado_inferido || 'EN RUTA').substring(0, 50),
        codigoUsuarioCreacion: 'SYS_AIS_ENGINE',
        fechaCreacion: new Date().toISOString(),
        codigoUsuarioModificacion: 'SYS_AIS_ENGINE',
        fechaModificacion: new Date().toISOString()
      };

      const sql = `
        MERGE INTO dbo.TCL_AisUltimaPosicion AS Target
        USING (SELECT 
          :mmsi AS mmsi, :imo AS imo, :nombre_motonave AS nombre_motonave, 
          :latitud AS latitud, :longitud AS longitud, :velocidad AS velocidad, 
          :rumbo AS rumbo, :destino AS destino, :estado_inferido AS estado_inferido, 
          :codigoUsuarioCreacion AS codigoUsuarioCreacion, :fechaCreacion AS fechaCreacion, 
          :codigoUsuarioModificacion AS codigoUsuarioModificacion, :fechaModificacion AS fechaModificacion
        ) AS Source 
        ON (Target.mmsi = Source.mmsi)
        WHEN MATCHED THEN
          UPDATE SET 
            latitud = Source.latitud, longitud = Source.longitud, velocidad = Source.velocidad, 
            rumbo = Source.rumbo, estado_inferido = Source.estado_inferido, 
            nombre_motonave = Source.nombre_motonave, destino = Source.destino, 
            omi = Source.imo, fechaModificacion = Source.fechaModificacion
        WHEN NOT MATCHED THEN
          INSERT (mmsi, omi, nombre_motonave, latitud, longitud, velocidad, rumbo, 
                  destino, estado_inferido, codigoUsuarioCreacion, fechaCreacion, 
                  codigoUsuarioModificacion, fechaModificacion)
          VALUES (Source.mmsi, Source.imo, Source.nombre_motonave, Source.latitud, Source.longitud, 
                  Source.velocidad, Source.rumbo, Source.destino, Source.estado_inferido, 
                  Source.codigoUsuarioCreacion, Source.fechaCreacion, 
                  Source.codigoUsuarioModificacion, Source.fechaModificacion);
      `;

      await db.sequelize.query(sql, {
        replacements: dataSegura,
        type: QueryTypes.RAW
      });

      return { exito: true };
    } catch (error) {
      console.error('❌ Error en guardarUltimaPosicionAIS:', error);
      throw error;
    }
  }

  /**
   * 18. Posiciones Unificadas DIMAR + AIS con las tablas estandarizadas dbo.TCL_Naves_* y dbo.TCL_AisUltimaPosicion
   */
  async getUltimasPosicionesNaves() {
    const query = `
      WITH DimarMaster AS (
        SELECT id_aviso, omi, motonave, agencia, eta, 'ARRIBADA' AS estado FROM dbo.TCL_NavesArribadas
        UNION ALL
        SELECT id_aviso, omi, motonave, agencia, eta, 'AVISADA' AS estado FROM dbo.TCL_NavesAvisadas
        UNION ALL
        SELECT id_aviso, omi, motonave, agencia, eta, 'FONDEO' AS estado FROM dbo.TCL_NavesFondeadas
        UNION ALL
        SELECT id_aviso, omi, motonave, agencia, eta, 'ZARPADA' AS estado FROM dbo.TCL_NavesZarpadas
      )
      SELECT 
        dimar.motonave,
        dimar.agencia,
        dimar.estado,
        dimar.eta,
        ais.latitud,
        ais.longitud,
        ais.velocidad,
        ais.estado_inferido,
        ais.mmsi
      FROM DimarMaster dimar
      LEFT JOIN dbo.TCL_HomologacionMMSI hom 
        ON CAST(dimar.id_aviso AS VARCHAR(20)) = CAST(hom.id_aviso AS VARCHAR(20))
      LEFT JOIN dbo.TCL_AisUltimaPosicion ais 
        ON CAST(hom.mmsi AS VARCHAR(20)) = CAST(ais.mmsi AS VARCHAR(20))
      WHERE ais.mmsi IS NULL OR (ais.latitud <> 0 AND ais.longitud <> 0)
    `;
    return await db.sequelize.query(query, { type: QueryTypes.SELECT });
  }

  async getPosicionesNavesUnificadas() {
    return await this.getUltimasPosicionesNaves();
  }

  async getNavePorId(idAviso) {
    return await db.sequelize.query(
      'SELECT * FROM dbo.TCL_NavesArribadas WHERE id_aviso = :id',
      {
        replacements: { id: idAviso },
        type: QueryTypes.SELECT
      }
    );
  }

  async purgarMotonavesZarpadas() {
    try {
      const sql = `
        DELETE FROM dbo.TCL_AisUltimaPosicion
        WHERE 
          (nombre_motonave IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM dbo.TCL_NavesAvisadas n 
            WHERE n.motonave = dbo.TCL_AisUltimaPosicion.nombre_motonave
          ))
          OR
          (TRY_CAST(fechaModificacion AS DATETIMEOFFSET) < DATEADD(hour, -12, GETUTCDATE()))
      `;

      const [resultados] = await db.sequelize.query(sql);
      return { exito: true, filasBorradas: resultados };
    } catch (error) {
      throw error;
    }
  }

  /**
   * 19. Puertos Activos desde dbo.TCL_MaestroPuertos (usando ubicacion_geo estandarizada)
   */
  async getPuertosActivos() {
    const query = `
      SELECT 
        id_puerto, 
        nombre, 
        ubicacion_geo.STStartPoint().STY AS lat, 
        ubicacion_geo.STStartPoint().STX AS lon,
        geocerca_geo.STEnvelope().STPointN(1).STY AS bbox_lat_sur,
        geocerca_geo.STEnvelope().STPointN(1).STX AS bbox_lon_oeste,
        geocerca_geo.STEnvelope().STPointN(3).STY AS bbox_lat_norte,
        geocerca_geo.STEnvelope().STPointN(3).STX AS bbox_lon_este
      FROM dbo.TCL_MaestroPuertos 
      WHERE COALESCE(estado, 1) = 1
    `;

    return await db.sequelize.query(query, {
      type: QueryTypes.SELECT
    });
  }

  async getPuertosParaMapa() {
    try {
      const sql = `
        SELECT 
          id_puerto,
          nombre,
          geocerca_geo.STEnvelope().STPointN(1).STY AS bbox_lat_sur,
        geocerca_geo.STEnvelope().STPointN(1).STX AS bbox_lon_oeste,
        geocerca_geo.STEnvelope().STPointN(3).STY AS bbox_lat_norte,
        geocerca_geo.STEnvelope().STPointN(3).STX AS bbox_lon_este 
        FROM dbo.TCL_MaestroPuertos 
        WHERE geocerca_geo IS NOT NULL
      `;
      return await db.sequelize.query(sql, { type: QueryTypes.SELECT });
    } catch (error) {
      return [];
    }
  }

  /** MMSI de referencia para un número OMI (tabla TCL_Referencia_OMI_MMSI). */
  async getMmsiPorOmi(omi) {
    const [ref] = await db.sequelize.query(
      'SELECT TOP 1 mmsi FROM dbo.TCL_Referencia_OMI_MMSI WHERE omi = :omi',
      { replacements: { omi }, type: QueryTypes.SELECT }
    );
    return ref?.mmsi || null;
  }

  async getNavesSinHomologar() {
    const query = `
      SELECT d.id_aviso, d.motonave, d.omi 
      FROM dbo.TCL_NavesArribadas d
      WHERE NOT EXISTS (
        SELECT 1 FROM dbo.TCL_HomologacionMMSI h 
        WHERE CAST(h.id_aviso AS VARCHAR(20)) = CAST(d.id_aviso AS VARCHAR(20))
      )
    `;
    return await db.sequelize.query(query, { type: QueryTypes.SELECT });
  }

  async registrarHomologacion(idAviso, mmsi) {
    const query = `
      INSERT INTO dbo.TCL_HomologacionMMSI (id_aviso, mmsi) 
      VALUES (:id_aviso, :mmsi)
    `;
    return await db.sequelize.query(query, {
      replacements: { id_aviso: idAviso, mmsi }
    });
  }

  /**
   * MMSI de naves avisadas (últimos 7 días) resueltos vía la tabla de referencia OMI → MMSI.
   * Lo usa el motor AIS cuando AIS_SOLO_AVISADAS=true.
   */
  async getMmsiParaRastreo() {
    try {
      // MMSI homologados (TCL_Homologacion_MMSI) de naves avisadas con ETA en la ventana -7d / +15d
      const sql = `
        SELECT DISTINCT CAST(h.mmsi AS VARCHAR(20)) AS mmsi
        FROM dbo.TCL_NavesAvisadas a
        INNER JOIN dbo.TCL_HomologacionMMSI h
          ON CAST(h.id_aviso AS VARCHAR(100)) = a.id_aviso
        WHERE TRY_CONVERT(DATETIMEOFFSET, a.eta, 127) BETWEEN DATEADD(day, -7, SYSDATETIMEOFFSET()) AND DATEADD(day, 15, SYSDATETIMEOFFSET())
          AND h.mmsi IS NOT NULL
      `;
      const filas = await db.sequelize.query(sql, { type: QueryTypes.SELECT });
      return filas.map((f) => String(f.mmsi).trim()).filter((m) => /^\d{9}$/.test(m));
    } catch (error) {
      console.error('❌ [AIS] Error obteniendo MMSI para rastreo:', error.message);
      return [];
    }
  }

  /**
   * Geocercas operativas para ubicar cada nave: muelles, terminales y puertos.
   * Se consultan por separado para que un error en una tabla no apague las otras.
   * Devuelve WKT (X = longitud, Y = latitud); MakeValid() corrige polígonos mal cerrados.
   */
  async getZonasOperativasAIS() {
    const consultas = {
      muelles: `
        SELECT m.codigo_muelle, m.id_terminal, t.id_puerto, m.codigo_muelle AS nombre,
               m.geocerca_geo.MakeValid().STAsText() AS wkt
        FROM dbo.TCL_MaestroMuelles m
        LEFT JOIN dbo.TCL_MaestroTerminales t ON t.id_terminal = m.id_terminal
        WHERE m.geocerca_geo IS NOT NULL`,
      terminales: `
        SELECT NULL AS codigo_muelle, t.id_terminal, t.id_puerto, t.nombre,
               t.geocerca_geo.MakeValid().STAsText() AS wkt
        FROM dbo.TCL_MaestroTerminales t
        WHERE t.geocerca_geo IS NOT NULL AND (t.estado = 1 OR t.estado IS NULL)`,
      puertos: `
        SELECT NULL AS codigo_muelle, NULL AS id_terminal, p.id_puerto, p.nombre,
               p.geocerca_geo.MakeValid().STAsText() AS wkt
        FROM dbo.TCL_MaestroPuertos p
        WHERE p.geocerca_geo IS NOT NULL`,
    };

    const zonas = { muelles: [], terminales: [], puertos: [] };
    for (const [tipo, sql] of Object.entries(consultas)) {
      try {
        zonas[tipo] = await db.sequelize.query(sql, { type: QueryTypes.SELECT });
      } catch (error) {
        console.error(`❌ [AIS] Error cargando geocercas de ${tipo}:`, error.message);
      }
    }
    return zonas;
  }

  /**
   * Detecta si ya se corrió la migración 005 (columnas extendidas + bitácora de eventos).
   * El motor AIS funciona con o sin ellas.
   */
  async getCapacidadesEstadoAIS() {
    try {
      const [fila] = await db.sequelize.query(`
        SELECT
          (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'TCL_AisUltimaPosicion'
              AND COLUMN_NAME IN ('estado_nav_ais','id_puerto','id_terminal','codigo_muelle','fecha_cambio_estado')) AS columnas,
          CASE WHEN OBJECT_ID(N'dbo.TCL_EventosEstadoNave', N'U') IS NOT NULL THEN 1 ELSE 0 END AS tabla_eventos
      `, { type: QueryTypes.SELECT });
      return {
        columnasExtendidas: Number(fila?.columnas) === 5,
        tablaEventos: Number(fila?.tabla_eventos) === 1,
      };
    } catch (error) {
      console.error('❌ [AIS] Error detectando columnas de estado:', error.message);
      return { columnasExtendidas: false, tablaEventos: false };
    }
  }

  /** Último estado conocido de cada nave, para no perder el "desde cuándo" al reiniciar el API. */
  async getEstadosAISVigentes(extendido = false) {
    try {
      const sql = `
        SELECT CAST(mmsi AS VARCHAR(20)) AS mmsi, estado_inferido
               ${extendido ? ', fecha_cambio_estado' : ''}
        FROM dbo.TCL_AisUltimaPosicion
        WHERE estado_inferido IS NOT NULL`;
      return await db.sequelize.query(sql, { type: QueryTypes.SELECT });
    } catch (error) {
      console.error('❌ [AIS] Error leyendo estados vigentes:', error.message);
      return [];
    }
  }

  /**
   * Upsert por lotes en dbo.TCL_AisUltimaPosicion (una sola sentencia MERGE por lote).
   * No sobreescribe nombre/destino con NULL cuando aún no llega la trama estática.
   * Con { extendido: true } también guarda estado AIS declarado, zona y fecha del último cambio de estado
   * (requiere la migración 005).
   * @param {Array<{mmsi:string,lat:number,lon:number,velocidad:number,rumbo:number,
   *               estadoInferido:string,nombre_motonave?:string|null,destino?:string|null,
   *               navStatus?:number|null,zona?:object|null,estadoDesde?:number|null}>} posiciones
   * @param {{extendido?:boolean}} opciones
   */
  async guardarPosicionesAISLote(posiciones, { extendido = false } = {}) {
    if (!Array.isArray(posiciones) || posiciones.length === 0) return 0;

    const replacements = { ahora: new Date().toISOString() };
    const filas = posiciones.map((p, i) => {
      replacements[`mmsi${i}`] = String(p.mmsi);
      replacements[`nom${i}`] = p.nombre_motonave ? String(p.nombre_motonave).substring(0, 50) : null;
      replacements[`lat${i}`] = Number(p.lat);
      replacements[`lon${i}`] = Number(p.lon);
      replacements[`vel${i}`] = Number(p.velocidad) || 0;
      replacements[`rum${i}`] = Number(p.rumbo) || 0;
      replacements[`des${i}`] = p.destino ? String(p.destino).substring(0, 50) : null;
      replacements[`est${i}`] = String(p.estadoInferido || 'DESCONOCIDO').substring(0, 50);
      // CAST explícito: si todo un lote trae NULL, SQL Server tiparía la columna como INT y el COALESCE fallaría
      const base = `CAST(:mmsi${i} AS NVARCHAR(20)), CAST(:nom${i} AS NVARCHAR(50)), :lat${i}, :lon${i}, :vel${i}, :rum${i}, `
        + `CAST(:des${i} AS NVARCHAR(50)), CAST(:est${i} AS NVARCHAR(50))`;
      if (!extendido) return `(${base})`;

      replacements[`nav${i}`] = Number.isInteger(p.navStatus) ? p.navStatus : null;
      replacements[`pto${i}`] = p.zona?.id_puerto ? String(p.zona.id_puerto).substring(0, 50) : null;
      replacements[`ter${i}`] = p.zona?.id_terminal ? String(p.zona.id_terminal).substring(0, 50) : null;
      replacements[`mue${i}`] = p.zona?.codigo_muelle ? String(p.zona.codigo_muelle).substring(0, 50) : null;
      replacements[`fce${i}`] = p.estadoDesde ? new Date(p.estadoDesde).toISOString() : null;
      return `(${base}, CAST(:nav${i} AS TINYINT), CAST(:pto${i} AS NVARCHAR(50)), CAST(:ter${i} AS NVARCHAR(50)), `
        + `CAST(:mue${i} AS NVARCHAR(50)), CAST(:fce${i} AS NVARCHAR(100)))`;
    });

    const colsExtra = extendido ? ', estado_nav_ais, id_puerto, id_terminal, codigo_muelle, fecha_cambio_estado' : '';
    const setExtra = extendido ? `,
          estado_nav_ais = Source.estado_nav_ais,
          id_puerto = Source.id_puerto, id_terminal = Source.id_terminal, codigo_muelle = Source.codigo_muelle,
          fecha_cambio_estado = COALESCE(Source.fecha_cambio_estado, Target.fecha_cambio_estado)` : '';
    const valExtra = extendido
      ? ', Source.estado_nav_ais, Source.id_puerto, Source.id_terminal, Source.codigo_muelle, Source.fecha_cambio_estado'
      : '';

    const sql = `
      MERGE INTO dbo.TCL_AisUltimaPosicion AS Target
      USING (VALUES ${filas.join(',\n             ')})
        AS Source (mmsi, nombre_motonave, latitud, longitud, velocidad, rumbo, destino, estado_inferido${colsExtra})
      ON (Target.mmsi = Source.mmsi)
      WHEN MATCHED THEN
        UPDATE SET
          latitud = Source.latitud, longitud = Source.longitud,
          velocidad = Source.velocidad, rumbo = Source.rumbo,
          estado_inferido = Source.estado_inferido,
          nombre_motonave = COALESCE(Source.nombre_motonave, Target.nombre_motonave),
          destino = COALESCE(Source.destino, Target.destino),
          codigoUsuarioModificacion = 'SYS_AIS_ENGINE',
          fechaModificacion = :ahora${setExtra}
      WHEN NOT MATCHED THEN
        INSERT (mmsi, omi, nombre_motonave, latitud, longitud, velocidad, rumbo,
                destino, estado_inferido, codigoUsuarioCreacion, fechaCreacion,
                codigoUsuarioModificacion, fechaModificacion${colsExtra})
        VALUES (Source.mmsi, NULL, COALESCE(Source.nombre_motonave, 'DESCONOCIDO'),
                Source.latitud, Source.longitud, Source.velocidad, Source.rumbo,
                COALESCE(Source.destino, 'SIN DESTINO'), Source.estado_inferido,
                'SYS_AIS_ENGINE', :ahora, 'SYS_AIS_ENGINE', :ahora${valExtra});
    `;

    await db.sequelize.query(sql, { replacements, type: QueryTypes.RAW });
    return posiciones.length;
  }

  /**
   * Bitácora de transiciones de estado (requiere la migración 005). Fechas en ISO UTC (convención Porttos).
   * Es la materia prima de los KPIs de tiempo en fondeo, tiempo atracado y congestión.
   */
  async guardarEventosEstadoNaveLote(eventos) {
    if (!Array.isArray(eventos) || eventos.length === 0) return 0;

    const replacements = { ahora: new Date().toISOString() };
    const filas = eventos.map((e, i) => {
      replacements[`mmsi${i}`] = String(e.mmsi);
      replacements[`nom${i}`] = e.nombre_motonave ? String(e.nombre_motonave).substring(0, 100) : null;
      replacements[`ant${i}`] = e.estado_anterior ? String(e.estado_anterior).substring(0, 30) : null;
      replacements[`nue${i}`] = String(e.estado_nuevo).substring(0, 30);
      replacements[`pto${i}`] = e.id_puerto ? String(e.id_puerto).substring(0, 50) : null;
      replacements[`ter${i}`] = e.id_terminal ? String(e.id_terminal).substring(0, 50) : null;
      replacements[`mue${i}`] = e.codigo_muelle ? String(e.codigo_muelle).substring(0, 50) : null;
      replacements[`lat${i}`] = Number.isFinite(e.lat) ? e.lat : null;
      replacements[`lon${i}`] = Number.isFinite(e.lon) ? e.lon : null;
      replacements[`vel${i}`] = Number.isFinite(e.velocidad) ? e.velocidad : null;
      replacements[`nav${i}`] = Number.isInteger(e.nav_status) ? e.nav_status : null;
      replacements[`dur${i}`] = Number.isFinite(e.duracion_anterior_min) ? Math.round(e.duracion_anterior_min) : null;
      replacements[`fec${i}`] = new Date(e.fecha).toISOString();
      return `(:mmsi${i}, :nom${i}, :ant${i}, :nue${i}, :pto${i}, :ter${i}, :mue${i}, :lat${i}, :lon${i}, :vel${i}, :nav${i}, :dur${i}, :fec${i}, 'SYS_AIS_ENGINE', :ahora)`;
    });

    const sql = `
      INSERT INTO dbo.TCL_EventosEstadoNave
        (mmsi, nombre_motonave, estado_anterior, estado_nuevo, id_puerto, id_terminal, codigo_muelle,
         latitud, longitud, velocidad, estado_nav_ais, duracion_anterior_min, fecha_evento,
         codigoUsuarioCreacion, fechaCreacion)
      VALUES ${filas.join(',\n             ')};
    `;
    await db.sequelize.query(sql, { replacements, type: QueryTypes.RAW });
    return eventos.length;
  }
}

module.exports = new MaritimoRepository();
module.exports.FECHA_LINEUP = FECHA_LINEUP;
