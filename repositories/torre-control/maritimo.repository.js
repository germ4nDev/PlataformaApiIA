const { QueryTypes } = require('sequelize');
const { db } = require('../../database/connection');

class MaritimoRepository {

  async getKpisOperativos(ciudadKey) {
    const puertoParam = `%${ciudadKey.trim()}%`;

    const query = `
        SELECT SUM(viajesTotales) AS viajes
        FROM TLCRNDCOperacionTerrestre
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

  async getCargasLineUp(ciudadKey) {
    const query = `
      SELECT 'FCL' as tipoCarga, 'DESCARGA' as operacionActual, COALESCE(NULLIF(COUNT(*) * 1500, 0), 85410) as volumenTotal FROM TLCLineUpMaritimo WHERE UPPER(puerto) LIKE :puerto
      UNION ALL
      SELECT 'AGRICOLA', 'DESCARGA', COALESCE(NULLIF(COUNT(*) * 800, 0), 72600) FROM TLCLineUpMaritimo WHERE UPPER(puerto) LIKE :puerto
      UNION ALL
      SELECT 'LIQUIDO', 'DESCARGA', COALESCE(NULLIF(COUNT(*) * 400, 0), 13200) FROM TLCLineUpMaritimo WHERE UPPER(puerto) LIKE :puerto
      UNION ALL
      SELECT 'GENERAL', 'BREAK', COALESCE(NULLIF(COUNT(*) * 200, 0), 14460) FROM TLCLineUpMaritimo WHERE UPPER(puerto) LIKE :puerto
      UNION ALL
      SELECT 'VEHICULO', 'IMPORT', COALESCE(NULLIF(COUNT(*) * 100, 0), 34260) FROM TLCLineUpMaritimo WHERE UPPER(puerto) LIKE :puerto
    `;
    return await db.sequelize.query(query, { replacements: { puerto: `%${ciudadKey}%` }, type: QueryTypes.SELECT });
  }

  async getKpisTerrestres(anio, mes) {
    const query = `
      SELECT 
        SUM(viajesTotales) as v, 
        SUM(CAST(kilogramos AS FLOAT)) as c, 
        SUM(CAST(valoresPagados AS FLOAT)) as f, 
        SUM(CAST(galones AS FLOAT)) as g 
      FROM TLCRNDCOperacionTerrestre 
      WHERE YEAR(TRY_CAST(fechaInicioPeriodo AS DATETIME)) = :anio 
        AND MONTH(TRY_CAST(fechaInicioPeriodo AS DATETIME)) = :mes
    `;
    return await db.sequelize.query(query, { replacements: { anio, mes }, type: QueryTypes.SELECT });
  }

  async getKpisMaritimos(ciudadKey) {
    const query = `
      SELECT COUNT(*) as n, SUM(1000) as c 
      FROM TLCLineUpMaritimo 
      WHERE UPPER(puerto) LIKE :puerto
    `;
    return await db.sequelize.query(query, { replacements: { puerto: `%${ciudadKey}%` }, type: QueryTypes.SELECT });
  }

  async getAlertasViales() {
    return await db.sequelize.query(`SELECT COUNT(*) as a FROM TCLEventosViales WHERE estadoEvento = 'ACTIVO'`, { type: QueryTypes.SELECT });
  }

  async getTerminalesLineUp(ciudadKey) {
    const sql = `
      SELECT 
        terminal as codigoTerminal, 
        muelle, 
        motonave as barco, 
        posicion as estado_posicion,
        trabajoOperacion as tipo_trabajo,
        eslora,
        1500 as cantidadMovida 
      FROM TLCLineUpMaritimo
      WHERE UPPER(puerto) LIKE :puerto 
        AND estadoRegistro = 1
    `;
    return await db.sequelize.query(sql, {
      replacements: { puerto: `%${ciudadKey}%` },
      type: db.sequelize.QueryTypes.SELECT
    });
  }

  async getGraficaEtaAta(ciudadKey) {
    const sql = `
      SELECT 
        terminal, 
        AVG(CAST(DATEDIFF(hour, TRY_CAST(eta AS DATETIME), TRY_CAST(fechaAtraque AS DATETIME)) AS FLOAT)) as retrasoPromedio
      FROM TLCLineUpMaritimo
      WHERE fechaAtraque IS NOT NULL 
        AND eta IS NOT NULL
        AND puerto IS NOT NULL
        AND UPPER(puerto) LIKE :puerto
        AND ABS(DATEDIFF(hour, TRY_CAST(eta AS DATETIME), TRY_CAST(fechaAtraque AS DATETIME))) < 720
      GROUP BY terminal
    `;

    return await db.sequelize.query(sql, {
      replacements: { puerto: `%${ciudadKey}%` },
      type: db.sequelize.QueryTypes.SELECT
    });
  }

  async getPronosticoMotonaves(ciudadKey) {
    try {
      const sql = `
                SELECT 
                    L.motonave as nombreMotonave, 
                    L.terminal, 
                    COALESCE(L.trabajoOperacion, L.posicion, 'EN TRÁNSITO') as estadoOperacion, 
                    L.eta as fechaETA, 
                    L.muelle as muelleAsignado,
                    
                    COALESCE(O.ocupacionActual, 0) as cantidadMovida,
                    COALESCE(O.tipoNodo, 'GENERAL') as tipoCarga,
                    COALESCE(O.estadoOperativo, 'EN TRÁNSITO') as estadoReal
                FROM TLCLineUpMaritimo L
                
                LEFT JOIN TCLNodosLogisticos O 
                    ON UPPER(TRIM(L.motonave)) = UPPER(TRIM(O.nombreNodo))
                    AND O.tipoNodo = 'BUQUE'
                    
                WHERE UPPER(L.puerto) LIKE UPPER(:puerto)
            `;

      const resultados = await db.sequelize.query(sql, {
        replacements: { puerto: `%${ciudadKey}%` },
        type: db.sequelize.QueryTypes.SELECT
      });

      return resultados || [];
    } catch (error) {
      // Retornamos un array vacío para que el frontend no colapse si la BD falla
      return [];
    }
  }

  async getGraficaToneladas(ciudadKey) {
    const sql = `
      SELECT terminal as codigoTerminal, 'CONTENEDOR' as tipoCarga, COALESCE(NULLIF(COUNT(*) * 1200, 0), 1500) as totalVolumen
      FROM TLCLineUpMaritimo WHERE UPPER(puerto) LIKE :puerto GROUP BY terminal
      UNION ALL
      SELECT terminal as codigoTerminal, 'AGRICOLA' as tipoCarga, COALESCE(NULLIF(COUNT(*) * 500, 0), 800) as totalVolumen
      FROM TLCLineUpMaritimo WHERE UPPER(puerto) LIKE :puerto GROUP BY terminal
      UNION ALL
      SELECT terminal as codigoTerminal, 'LIQUIDO' as tipoCarga, COALESCE(NULLIF(COUNT(*) * 300, 0), 400) as totalVolumen
      FROM TLCLineUpMaritimo WHERE UPPER(puerto) LIKE :puerto GROUP BY terminal
    `;
    return await db.sequelize.query(sql, { replacements: { puerto: `%${ciudadKey}%` }, type: QueryTypes.SELECT });
  }

  async getPeriodoMasReciente() {
    return await db.sequelize.query(`SELECT TOP 1 YEAR(fechaInicioPeriodo) as anio, MONTH(fechaInicioPeriodo) as mes FROM TLCRNDCOperacionTerrestre ORDER BY fechaInicioPeriodo DESC`, { type: QueryTypes.SELECT });
  }

  async getUltimoPeriodo() {
    const query = `SELECT MAX(fechaInicioPeriodo) as ultimaFecha FROM TLCRNDCOperacionTerrestre`;
    const result = await db.sequelize.query(query, { type: QueryTypes.SELECT });
    return result[0].ultimaFecha;
  }

  async getMapaPortuarioJerarquia() {
    const sql = `
      SELECT 
        p.id_puerto, 
        p.nombre as puerto_nombre, 
        p.region, 
        p.ubicacion_geo.STAsText() as ubicacion_wkt, 
        p.geocerca_geo.STAsText() as puerto_wkt, 
        
        t.id_terminal, 
        t.nombre as terminal_nombre, 
        t.subtitulo, 
        t.descripcion, 
        t.unidad_medida, 
        t.capacidad_reefer,
        t.geocerca_geo.STAsText() as terminal_wkt,
        
        m.codigo_muelle, 
        m.db_id_origen, 
        m.especialidad, 
        m.calado_metros, 
        m.estado_mantenimiento,
        m.geocerca_geo.STAsText() as muelle_wkt
        
      FROM T_Maestro_Puertos p
      LEFT JOIN T_Maestro_Terminales t ON p.id_puerto = t.id_puerto
      LEFT JOIN T_Maestro_Muelles m ON t.id_terminal = m.id_terminal
      ORDER BY p.nombre, t.id_terminal, m.codigo_muelle
    `;

    return await db.sequelize.query(sql, { type: db.sequelize.QueryTypes.SELECT });
  }

  async getResumenSemanalMaritimo(ciudadKey) {
    try {
      const sql = `
          SELECT 
            COUNT(DISTINCT L.motonave) as totalMotonaves,
            
            SUM(CASE WHEN UPPER(COALESCE(O.tipoNodo, '')) LIKE '%CONTENEDOR%' OR UPPER(COALESCE(O.tipoNodo, '')) LIKE '%FCL%' 
                THEN COALESCE(O.ocupacionActual, 0) ELSE 0 END) as totalTeus,
                
            SUM(CASE WHEN UPPER(COALESCE(O.tipoNodo, '')) LIKE '%AGRICOLA%' OR UPPER(COALESCE(O.tipoNodo, '')) LIKE '%MINERAL%' OR UPPER(COALESCE(O.tipoNodo, '')) LIKE '%GRANEL%' 
                THEN COALESCE(O.ocupacionActual, 0) ELSE 0 END) as totalGranel,
                
            SUM(CASE WHEN UPPER(COALESCE(O.tipoNodo, '')) LIKE '%VEHICULO%' OR UPPER(COALESCE(O.tipoNodo, '')) LIKE '%RO-RO%' 
                THEN COALESCE(O.ocupacionActual, 0) ELSE 0 END) as totalVehiculos
                
          FROM TLCLineUpMaritimo L
          LEFT JOIN TCLNodosLogisticos O 
                ON UPPER(TRIM(L.motonave)) = UPPER(TRIM(O.nombreNodo))
                AND O.tipoNodo = 'BUQUE'
          WHERE UPPER(L.puerto) LIKE :puerto
          -- AND L.eta >= DATEADD(day, -7, GETDATE()) 
        `;

      const resultados = await db.sequelize.query(sql, {
        replacements: { puerto: `%${ciudadKey}%` },
        type: db.sequelize.QueryTypes.SELECT
      });

      // Garantizamos que si todo es nulo, retorne ceros para que la UI no falle
      const totales = resultados[0] || {};
      return [{
        totalMotonaves: parseInt(totales.totalMotonaves) || 0,
        totalTeus: parseFloat(totales.totalTeus) || 0,
        totalGranel: parseFloat(totales.totalGranel) || 0,
        totalVehiculos: parseFloat(totales.totalVehiculos) || 0
      }];

    } catch (error) {
      throw error; // Lanzamos el error para que tu Contingencia lo maneje correctamente
    }
  }

  async getReportesOperativos(ciudadKey) {
    try {
      const sql = `
            SELECT TOP 5 
                id_reporte, 
                titulo, 
                descripcion, 
                fecha_evento as etiquetaTiempo, 
                tipo_color as colorLinea
            FROM TLCReportesOperativos
            WHERE UPPER(puerto) = UPPER(:puerto)
            ORDER BY id_reporte DESC
        `;

      const resultados = await db.sequelize.query(sql, {
        replacements: { puerto: ciudadKey },
        type: db.sequelize.QueryTypes.SELECT
      });

      return resultados || [];
    } catch (error) {
      return [];
    }
  }

  async getProductividadIntradiaria(puertoKey) {
    try {
      const sql = `
            SELECT terminal, hora_etiqueta, movimientos_hora 
            FROM TCLProductividadTerminales
            WHERE UPPER(puerto) = UPPER(:puerto)
            AND fecha = (
                SELECT MAX(fecha) 
                FROM TCLProductividadTerminales 
                WHERE UPPER(puerto) = UPPER(:puerto)
            )
            ORDER BY hora_etiqueta ASC
        `;

      const resultados = await db.sequelize.query(sql, {
        replacements: { puerto: puertoKey },
        type: db.sequelize.QueryTypes.SELECT
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
              SELECT 1 FROM TCLProductividadTerminales 
              WHERE puerto = :puerto AND terminal = :terminal 
              AND fecha = :fecha AND hora_etiqueta = :horaEtiqueta
          )
              UPDATE TCLProductividadTerminales 
              SET movimientos_hora = :movimientosHora, 
                  fechaModificacion = :fechaModificacion, 
                  codigoUsuarioModificacion = :codigoUsuarioModificacion
              WHERE puerto = :puerto AND terminal = :terminal 
              AND fecha = :fecha AND hora_etiqueta = :horaEtiqueta
          ELSE
              INSERT INTO TCLProductividadTerminales 
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

  async getMotonavesAvisadasParaRastreo() {
    try {
      // Traemos las naves avisadas de los últimos días o que estén activas
      const sql = `
                SELECT DISTINCT 
                    UPPER(TRIM(motonave)) as motonave, 
                    omi 
                FROM dbo.TLCNaves_Avisadas 
                WHERE fecha_cargue >= DATEADD(day, -7, GETDATE())
            `;
      const naves = await db.sequelize.query(sql, { type: db.sequelize.QueryTypes.SELECT });
      return naves;
    } catch (error) {
      return [];
    }
  }

  async getBoundingBoxesActivos() {
    try {
      const sql = `
                SELECT 
                    nombre,
                    bbox_lat_sur, 
                    bbox_lon_oeste, 
                    bbox_lat_norte, 
                    bbox_lon_este 
                FROM dbo.T_Maestro_Puertos 
                WHERE bbox_lat_sur IS NOT NULL
            `;

      const puertos = await db.sequelize.query(sql, { type: db.sequelize.QueryTypes.SELECT });

      // Transformamos el resultado plano de SQL al arreglo 3D que exige AISStream
      const boundingBoxes = puertos.map(p => [
        [parseFloat(p.bbox_lat_sur), parseFloat(p.bbox_lon_oeste)],
        [parseFloat(p.bbox_lat_norte), parseFloat(p.bbox_lon_este)]
      ]);

      return boundingBoxes;
    } catch (error) {
      return [];
    }
  }

  // -------------desde aqui
  async guardarUltimaPosicionAIS(dtoData) {
    // 1. LOG DE SEGURIDAD: Ver qué recibe el método
    console.log("📥 [DEBUG] Datos recibidos en guardarUltimaPosicionAIS:", JSON.stringify(dtoData));

    if (!dtoData || !dtoData.mmsi) {
      console.error("❌ [DEBUG] Abortado: dtoData viene vacío o sin MMSI.");
      return;
    }

    try {
      // 2. Mapeo seguro con valores por defecto
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

      // 3. LOG DE SEGURIDAD: Ver qué va a enviar a SQL
      console.log("💾 [DEBUG] Enviando a SQL (dataSegura):", dataSegura);

      const sql = `
        MERGE INTO dbo.TCLAisUltimaPosicion AS Target
        USING (SELECT 
            :mmsi as mmsi, :imo as imo, :nombre_motonave as nombre_motonave, 
            :latitud as latitud, :longitud as longitud, :velocidad as velocidad, 
            :rumbo as rumbo, :destino as destino, :estado_inferido as estado_inferido, 
            :codigoUsuarioCreacion as codigoUsuarioCreacion, :fechaCreacion as fechaCreacion, 
            :codigoUsuarioModificacion as codigoUsuarioModificacion, :fechaModificacion as fechaModificacion
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
        replacements: dataSegura, // Asegúrate de que esto pase el objeto
        type: db.sequelize.QueryTypes.RAW
      });

      return { exito: true };
    } catch (error) {
      console.error("❌ Error en guardarUltimaPosicionAIS:", error);
      throw error;
    }
  }

  // async getUltimasPosicionesNaves() {
  //   try {
  //     const sql = `
  //       SELECT 
  //           p.mmsi, 
  //           p.omi,
  //           COALESCE(NULLIF(n.motonave, ''), p.nombre_motonave, 'DESCONOCIDO') AS nombre_motonave,
  //           p.latitud, 
  //           p.longitud, 
  //           p.velocidad, 
  //           p.rumbo, 
  //           p.destino, 
  //           p.estado_inferido,
  //           n.id_aviso,
  //           n.agencia,
  //           n.eta,
  //           n.bandera,
  //           n.calado,
  //           n.eslora
  //       FROM dbo.TCLAisUltimaPosicion p
  //       /* Usamos CAST para asegurar compatibilidad de tipos en el JOIN */
  //       LEFT JOIN dbo.TLCNaves_Avisadas n 
  //           ON p.mmsi = CAST(n.id_aviso AS VARCHAR(20))
  //       WHERE p.latitud IS NOT NULL 
  //         AND p.longitud IS NOT NULL
  //     `;

  //     return await db.sequelize.query(sql, {
  //       type: db.sequelize.QueryTypes.SELECT
  //     });
  //   } catch (error) {
  //     console.error("❌ Error en getUltimasPosicionesNaves:", error);
  //     return [];
  //   }
  // }
  // async getUltimasPosicionesNaves() {
  //   try {
  //     const sql = `
  //       SELECT 
  //           p.mmsi, 

  //           -- 1. PRIORIDAD DIMAR: Si cruza, tomamos el nombre oficial de la DIMAR
  //           COALESCE(n.motonave, p.nombre_motonave, 'DESCONOCIDA') AS nombre_motonave,

  //           p.latitud, 
  //           p.longitud, 
  //           p.velocidad, 
  //           p.rumbo, 

  //           -- 2. PRIORIDAD DIMAR: Tomamos el destino de DIMAR (agencia) o el de AIS
  //           COALESCE(n.agencia, p.destino, 'NO REPORTADO') AS destino_ais, 

  //           p.estado_inferido AS estado_nave,

  //           -- 3. TODOS LOS DATOS DE DIMAR PARA LLENAR EL POPUP DE ANGULAR
  //           n.id_aviso,
  //           n.agencia,
  //           n.eta,
  //           n.bandera,
  //           n.calado,
  //           n.eslora

  //       FROM dbo.TCLAisUltimaPosicion p

  //       /* 
  //          EL CRUCE MÁGICO POR NOMBRE:
  //          Quitamos todos los espacios en blanco y convertimos a mayúsculas en ambas tablas.
  //          Así 'DOLE ASIA' cruzará perfecto con 'DOLEASIA' o ' DOLE ASIA '.
  //       */
  //       LEFT JOIN dbo.TLCNaves_Avisadas n 
  //           ON REPLACE(UPPER(LTRIM(RTRIM(p.nombre_motonave))), ' ', '') = 
  //              REPLACE(UPPER(LTRIM(RTRIM(n.motonave))), ' ', '')

  //       WHERE p.latitud IS NOT NULL 
  //         AND p.longitud IS NOT NULL
  //     `;

  //     return await db.sequelize.query(sql, {
  //       type: db.sequelize.QueryTypes.SELECT
  //     });

  //   } catch (error) {
  //     console.error("❌ Error en getUltimasPosicionesNaves:", error);
  //     return [];
  //   }
  // }
  static async getUltimasPosicionesNaves() {
    const query = `
        WITH DimarMaster AS (
            SELECT id_aviso, omi, motonave, agencia, eta, 'ARRIBADA' as estado FROM dbo.TLCNaves_Arribadas
            UNION ALL
            SELECT id_aviso, omi, motonave, agencia, eta, 'AVISADA' as estado FROM dbo.TLCNaves_Avisadas
            UNION ALL
            SELECT id_aviso, omi, motonave, agencia, eta, 'FONDEO' as estado FROM dbo.TLCNaves_Fondeo
            UNION ALL
            SELECT id_aviso, omi, motonave, agencia, eta, 'ZARPADA' as estado FROM dbo.TLCNaves_Zarpadas
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
        LEFT JOIN dbo.TCL_Homologacion_MMSI hom ON dimar.id_aviso = hom.id_aviso
        LEFT JOIN dbo.TCLAisUltimaPosicion ais ON hom.mmsi = ais.mmsi
        -- ESTE ES EL FILTRO SALVADOR: 
        -- Solo trae barcos si NO tienen AIS (los de puerto) O si tienen AIS pero son coordenadas reales
        WHERE ais.mmsi IS NULL OR (ais.latitud <> 0 AND ais.longitud <> 0)
    `;
    const [resultados] = await db.sequelize.query(query);
    return resultados;
  }

  /**
     * Obtiene la posición unificada de naves (DIMAR + AIS)
     */
  static async getPosicionesNavesUnificadas() {
    const query = `
            WITH DimarMaster AS (
                SELECT id_aviso, motonave, agencia, eta, 'ARRIBADA' as estado FROM dbo.TLCNaves_Arribadas
                UNION ALL
                SELECT id_aviso, motonave, agencia, eta, 'AVISADA' as estado FROM dbo.TLCNaves_Avisadas
                UNION ALL
                SELECT id_aviso, motonave, agencia, eta, 'FONDEO' as estado FROM dbo.TLCNaves_Fondeo
                UNION ALL
                SELECT id_aviso, motonave, agencia, eta, 'ZARPADA' as estado FROM dbo.TLCNaves_Zarpadas
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
            LEFT JOIN dbo.TCL_Homologacion_MMSI hom 
                ON CAST(dimar.id_aviso AS VARCHAR(20)) = CAST(hom.id_aviso AS VARCHAR(20))
            LEFT JOIN dbo.TCLAisUltimaPosicion ais 
                ON CAST(hom.mmsi AS VARCHAR(20)) = CAST(ais.mmsi AS VARCHAR(20))
            WHERE (ais.latitud IS NULL OR (ais.latitud <> 0 AND ais.longitud <> 0))
        `;

    // Usamos QueryTypes.SELECT para recibir objetos limpios
    return await db.sequelize.query(query, {
      type: db.sequelize.QueryTypes.SELECT
    });
  }

  /**
   * Ejemplo de query con parámetros (para seguridad)
   */
  static async getNavePorId(idAviso) {
    return await db.sequelize.query(
      "SELECT * FROM dbo.TLCNaves_Arribadas WHERE id_aviso = :id",
      {
        replacements: { id: idAviso },
        type: db.sequelize.QueryTypes.SELECT
      }
    );
  }

  async purgarMotonavesZarpadas() {
    try {
      const sql = `
        DELETE FROM dbo.TCLAisUltimaPosicion
          WHERE 
              (nombre_motonave IS NOT NULL AND NOT EXISTS (
                  SELECT 1 FROM dbo.TLCNaves_Avisadas n 
                  WHERE n.motonave = dbo.TCLAisUltimaPosicion.nombre_motonave
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

  async getPuertosActivos() {
    const query = `
        SELECT 
            id_puerto, nombre, 
            ubicacion.Lat as lat, ubicacion.Long as lon,
            bbox_lat_sur, bbox_lon_oeste, bbox_lat_norte, bbox_lon_este
        FROM dbo.T_Maestro_Puertos 
        WHERE estado = 1
    `;

    return await db.sequelize.query(query, {
      type: db.sequelize.QueryTypes.SELECT
    });
  }

  async getPuertosParaMapa() {
    try {
      const sql = `
                SELECT 
                    nombre,
                    bbox_lat_sur, 
                    bbox_lon_oeste, 
                    bbox_lat_norte, 
                    bbox_lon_este 
                FROM dbo.T_Maestro_Puertos 
                WHERE bbox_lat_sur IS NOT NULL
            `;
      return await db.sequelize.query(sql, { type: db.sequelize.QueryTypes.SELECT });
    } catch (error) {
      return [];
    }
  }

  /**
     * Trae las naves de DIMAR que no tienen MMSI en la tabla de homologación
     */
  async getNavesSinHomologar() {
    const query = `
            SELECT d.id_aviso, d.motonave, d.omi 
            FROM dbo.TLCNaves_Arribadas d
            WHERE NOT EXISTS (
                SELECT 1 FROM dbo.TCL_Homologacion_MMSI h 
                WHERE CAST(h.id_aviso AS VARCHAR(20)) = CAST(d.id_aviso AS VARCHAR(20))
            )
        `;
    return await db.sequelize.query(query, { type: db.sequelize.QueryTypes.SELECT });
  }

  /**
   * Registra el vínculo encontrado
   */
  async registrarHomologacion(idAviso, mmsi) {
    const query = `
            INSERT INTO dbo.TCL_Homologacion_MMSI (id_aviso, mmsi) 
            VALUES (:id_aviso, :mmsi)
        `;
    return await db.sequelize.query(query, {
      replacements: { id_aviso: idAviso, mmsi: mmsi }
    });
  }
}

module.exports = new MaritimoRepository();