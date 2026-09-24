// /*
//     Author: German Dario Valencia Salazar
//     Pattern: PORTTOS Repository Pattern - Flota Terrestre (Completo y Sincronizado)
// */
// const { sequelize } = require('../../models');
// const { QueryTypes } = require('sequelize');

// class FlotaTerrestreRepository {

//   // 1. Obtiene los datos geográficos para el mapa
//   async obtenerDatosGeograficosFlota() {
//     const query = `
//       SELECT 
//         c.placa, 
//         c.ubicacion_geo.STAsText() AS wkt_posicion,
//         c.estado,
//         c.ultima_actualizacion,
//         c.velocidad,
//         v.tipo_camion,
//         v.modelo,
//         v.marca
//       FROM TLCFlotaTerrestre c WITH(NOLOCK)
//       LEFT JOIN T_Maestro_Camiones v WITH(NOLOCK) ON c.placa = v.placa 
//       WHERE c.ubicacion_geo IS NOT NULL
//     `;

//     try {
//       const resultados = await sequelize.query(query, { type: QueryTypes.SELECT });

//       return resultados.map(item => {
//         // 🟢 REGEX MEJORADO: Ignora espacios vacíos y captura solo los números/signos
//         const match = item.wkt_posicion ? item.wkt_posicion.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i) : null;

//         if (!match) return null; // Si sigue fallando algo raro, lo descartamos

//         return {
//           ...item,
//           lon: parseFloat(match[1]),
//           lat: parseFloat(match[2])
//         };
//       }).filter(item => item !== null); // Retorna solo los camiones exitosos

//     } catch (error) {
//       console.error('❌ [ERROR DATOS FLOTA]:', error?.message);
//       return [];
//     }
//   }

//   // 2. Detectar eventos en geocercas (Soluciona el error actual de la consola)
//   async detectarEventosGeocerca() {
//     const query = `
//         SELECT T.placa, G.nombre_faro AS Lugar, G.tipo_faro AS tipo, GETDATE() AS FechaEvento
//         FROM TLCFlotaTerrestre T WITH(NOLOCK)
//         INNER JOIN T_Maestro_Faros G WITH(NOLOCK) 
//             ON T.ubicacion_geo.STIntersects(G.geocerca_geo) = 1
//         WHERE G.estado = 1 AND T.ubicacion_geo IS NOT NULL;
//     `;
//     try {
//       const eventos = await sequelize.query(query, { type: QueryTypes.SELECT });
//       return eventos || [];
//     } catch (error) {
//       console.error('❌ [ERROR DETECTAR EVENTOS]:', error?.message);
//       return [];
//     }
//   }

//   // 3. Motor vectorial masivo con Snap-to-Road (Libre de errores de Hint)
//   // async ejecutarMotorVectorial() {
//   //   const sqlQuery = `
//   //       UPDATE T
//   //       SET 
//   //           -- 3. Si encuentra una vía a menos de 1km, imanta el camión. Si no, usa el punto libre.
//   //           ubicacion_geo = ISNULL(ViaCercana.PuntoAsfalto, Teorico.Punto),
//   //           ultima_actualizacion = GETDATE()
//   //       OUTPUT inserted.placa
//   //       FROM TLCFlotaTerrestre T
//   //       -- 1. Calculamos el vector de movimiento libre (hacia dónde avanza)
//   //       CROSS APPLY (
//   //           SELECT geometry::Point(
//   //               T.ubicacion_geo.STX + (ISNULL(T.velocidad, 10) * 0.000015),
//   //               T.ubicacion_geo.STY + (ISNULL(T.velocidad, 10) * 0.000015),
//   //               4326
//   //           ) AS Punto
//   //       ) Teorico
//   //       -- 2. Buscamos el asfalto más cercano sin usar hints de índices forzados
//   //       OUTER APPLY (
//   //           SELECT TOP 1 Teorico.Punto.ShortestLineTo(R.geometria_via).STEndPoint() AS PuntoAsfalto
//   //           FROM TCL_RedVial R 
//   //           -- Restringimos la búsqueda a vías muy cercanas para mantener el cron rápido
//   //           WHERE R.geometria_via.STDistance(Teorico.Punto) < 0.01 
//   //           ORDER BY R.geometria_via.STDistance(Teorico.Punto) ASC
//   //       ) ViaCercana
//   //       WHERE T.ubicacion_geo IS NOT NULL;
//   //   `;

//   //   try {
//   //     // Ejecutamos la consulta y atrapamos las placas modificadas desde el OUTPUT
//   //     const resultados = await sequelize.query(sqlQuery, { type: QueryTypes.SELECT });

//   //     // Contamos la longitud del arreglo para decirle al cron de Node.js cuántos movió realmente
//   //     const filasMovidas = Array.isArray(resultados) ? resultados.length : 0;

//   //     return [[{ FilasMovidas: filasMovidas }]];

//   //   } catch (error) {
//   //     console.error('❌ [ERROR MOTOR VECTORIAL]:', error?.message);
//   //     return [[{ FilasMovidas: 0 }]];
//   //   }
//   // }
//   // 3. Motor vectorial masivo (Modelo "Waypoints") - Ultra veloz y realista
//   async ejecutarMotorVectorial() {
//     const sqlQuery = `
//         SET NOCOUNT ON;

//         -- 1. Actualizamos el "paso" en la cabeza de los camiones (Si llegan al destino, se devuelven al inicio)
//         UPDATE F
//         SET F.paso_actual = CASE 
//                 WHEN F.paso_actual >= R.max_pasos THEN 1 
//                 ELSE F.paso_actual + 1 
//             END
//         FROM TLCFlotaTerrestre F
//         INNER JOIN TCL_Simulador_Rutas R ON F.id_ruta = R.id_ruta
//         WHERE F.id_ruta IS NOT NULL;

//         -- 2. Teletransportamos la flota masivamente al paso exacto en su ruta
//         UPDATE F
//         SET 
//             F.ubicacion_geo = W.ubicacion_geo,
//             F.ultima_actualizacion = GETDATE()
//         OUTPUT inserted.placa
//         FROM TLCFlotaTerrestre F
//         INNER JOIN TCL_Simulador_Waypoints W 
//             ON F.id_ruta = W.id_ruta AND F.paso_actual = W.paso;
//     `;

//     try {
//       const resultados = await sequelize.query(sqlQuery, { type: QueryTypes.SELECT });
//       const filasMovidas = Array.isArray(resultados) ? resultados.length : 0;

//       return [[{ FilasMovidas: filasMovidas }]];
//     } catch (error) {
//       console.error('❌ [ERROR MOTOR WAYPOINTS]:', error?.message);
//       return [[{ FilasMovidas: 0 }]];
//     }
//   }

//   // 4. Tablero de KPIs unificado (Terrestre y Marítimo)
//   async obtenerGeocercasConKPIs() {
//     const query = `
//       SELECT 
//           g.id_faro, 
//           g.nombre_faro, 
//           g.radio_metros,
//           g.tipo_faro,
//           g.descripcion, 
//           g.color_ui,
//           g.geocerca_geo.STAsText() as wkt,

//           ISNULL(kpi_camiones.total_camiones, 0) as total_camiones,
//           ISNULL(kpi_camiones.en_ruta, 0) as camiones_ruta,
//           ISNULL(kpi_camiones.detenidos, 0) as camiones_detenidos,

//           ISNULL(kpi_naves.total_naves, 0) as total_naves,
//           ISNULL(kpi_naves.fondeadas, 0) as fondeadas,
//           ISNULL(kpi_naves.avisadas, 0) as avisadas,
//           ISNULL(kpi_naves.arribadas, 0) as arribadas,

//           CASE 
//               WHEN (ISNULL(kpi_camiones.total_camiones, 0) + ISNULL(kpi_naves.total_naves, 0)) > 50 THEN 'ROJO'
//               WHEN (ISNULL(kpi_camiones.total_camiones, 0) + ISNULL(kpi_naves.total_naves, 0)) > 20 THEN 'AMARILLO'
//               ELSE 'VERDE'
//           END as estado_kpi

//       FROM T_Maestro_Faros g WITH(NOLOCK)

//       OUTER APPLY (
//           SELECT 
//               COUNT(DISTINCT c.placa) as total_camiones,
//               SUM(CASE WHEN c.estado = 'EN_RUTA' THEN 1 ELSE 0 END) as en_ruta,
//               SUM(CASE WHEN c.estado != 'EN_RUTA' THEN 1 ELSE 0 END) as detenidos
//           FROM TLCFlotaTerrestre c WITH(NOLOCK) 
//           WHERE c.ubicacion_geo IS NOT NULL 
//           AND c.ubicacion_geo.STIntersects(g.geocerca_geo) = 1
//       ) kpi_camiones

//       OUTER APPLY (
//           SELECT 
//               COUNT(DISTINCT ais.mmsi) as total_naves,
//               SUM(CASE WHEN perfiles.estado_nave = 'FONDEADAS' THEN 1 ELSE 0 END) as fondeadas,
//               SUM(CASE WHEN perfiles.estado_nave = 'AVISADAS' THEN 1 ELSE 0 END) as avisadas,
//               SUM(CASE WHEN perfiles.estado_nave = 'ARRIBADAS' THEN 1 ELSE 0 END) as arribadas
//           FROM TCLAisUltimaPosicion ais WITH(NOLOCK)
//           LEFT JOIN (
//               SELECT omi, 'AVISADAS' as estado_nave FROM TLCNaves_Avisadas WITH(NOLOCK) WHERE omi IS NOT NULL
//               UNION ALL
//               SELECT omi, 'FONDEADAS' as estado_nave FROM TLCNaves_Fondeadas WITH(NOLOCK) WHERE omi IS NOT NULL
//               UNION ALL
//               SELECT omi, 'ARRIBADAS' as estado_nave FROM TLCNaves_Arribadas WITH(NOLOCK) WHERE omi IS NOT NULL
//               UNION ALL
//               SELECT omi, 'ZARPADAS' as estado_nave FROM TLCNaves_Zarpadas WITH(NOLOCK) WHERE omi IS NOT NULL
//           ) perfiles ON RIGHT(LTRIM(RTRIM(ais.omi)), 6) = LTRIM(RTRIM(perfiles.omi))
//           WHERE ais.latitud IS NOT NULL AND ais.longitud IS NOT NULL
//           AND geometry::Point(ais.longitud, ais.latitud, 4326).STIntersects(g.geocerca_geo) = 1
//       ) kpi_naves

//       WHERE g.estado = 1;
//     `;

//     try {
//       const [resultados] = await sequelize.query(query);
//       return resultados || [];
//     } catch (error) {
//       console.error('❌ [ERROR KPIS GEOCERCAS]:', error?.message);
//       return [];
//     }
//   }

//   // 5. Zonas marítimas
//   async obtenerGeocercasMaritimas() {
//     const query = `
//       SELECT id_faro, nombre_faro, radio_metros, color_ui, descripcion, 
//              geocerca_geo.STAsText() as wkt
//       FROM T_Maestro_Faros WITH(NOLOCK)
//       WHERE tipo_faro = 'MARITIMA' AND estado = 1;
//     `;
//     try {
//       const [resultados] = await sequelize.query(query);
//       return resultados || [];
//     } catch (error) {
//       console.error('❌ [ERROR FAROS MARÍTIMOS]:', error?.message);
//       return [];
//     }
//   }

//   // 6. Upsert Atómico por Placa
//   async upsertPosicion(dtoData) {
//     const { placa, lon, lat, estado, velocidad } = dtoData;
//     const query = `
//       MERGE INTO TLCFlotaTerrestre AS target
//       USING (SELECT :placa AS placa) AS source
//       ON (target.placa = source.placa)
//       WHEN MATCHED THEN
//           UPDATE SET 
//               ubicacion_geo = geometry::STPointFromText('POINT(' + CAST(:lon AS VARCHAR(20)) + ' ' + CAST(:lat AS VARCHAR(20)) + ')', 4326),
//               ultima_actualizacion = GETDATE(),
//               velocidad = :velocidad,
//               estado = :estado
//       WHEN NOT MATCHED THEN
//           INSERT (placa, ubicacion_geo, ultima_actualizacion, velocidad, estado)
//           VALUES (:placa, geometry::STPointFromText('POINT(' + CAST(:lon AS VARCHAR(20)) + ' ' + CAST(:lat AS VARCHAR(20)) + ')', 4326), GETDATE(), :velocidad, :estado);
//     `;

//     return await sequelize.query(query, {
//       replacements: {
//         placa: placa,
//         lon: lon,
//         lat: lat,
//         velocidad: velocidad || 0,
//         estado: estado || 'EN_RUTA'
//       },
//       type: QueryTypes.RAW
//     });
//   }
// }

// module.exports = new FlotaTerrestreRepository();
/*
    Author: German Dario Valencia Salazar
    Pattern: PORTTOS Repository Pattern - Flota Terrestre (Completo y Sincronizado con Ruteo y Rotación)
*/
const { sequelize } = require('../../models');
const { QueryTypes } = require('sequelize');

class FlotaTerrestreRepository {

  // 1. Obtiene los datos geográficos para el mapa
  async obtenerDatosGeograficosFlota() {
    const query = `
      SELECT 
        c.placa, 
        c.ubicacion_geo.STAsText() AS wkt_posicion,
        c.estado,
        c.ultima_actualizacion,
        c.velocidad,
        c.rumbo, -- 🟢 Agregamos la rotación para el Frontend
        v.tipo_camion,
        v.modelo,
        v.marca
      FROM TLCFlotaTerrestre c WITH(NOLOCK)
      LEFT JOIN T_Maestro_Camiones v WITH(NOLOCK) ON c.placa = v.placa 
      WHERE c.ubicacion_geo IS NOT NULL
    `;

    try {
      const resultados = await sequelize.query(query, { type: QueryTypes.SELECT });

      return resultados.map(item => {
        // 🟢 REGEX MEJORADO: Ignora espacios vacíos y captura solo los números/signos
        const match = item.wkt_posicion ? item.wkt_posicion.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i) : null;

        if (!match) return null; // Si sigue fallando algo raro, lo descartamos

        return {
          ...item,
          lon: parseFloat(match[1]),
          lat: parseFloat(match[2])
        };
      }).filter(item => item !== null); // Retorna solo los camiones exitosos

    } catch (error) {
      console.error('❌ [ERROR DATOS FLOTA]:', error?.message);
      return [];
    }
  }

  // 2. Detectar eventos en geocercas
  async detectarEventosGeocerca() {
    const query = `
        SELECT T.placa, G.nombre_faro AS Lugar, G.tipo_faro AS tipo, GETDATE() AS FechaEvento
        FROM TLCFlotaTerrestre T WITH(NOLOCK)
        INNER JOIN T_Maestro_Faros G WITH(NOLOCK) 
            ON T.ubicacion_geo.STIntersects(G.geocerca_geo) = 1
        WHERE G.estado = 1 AND T.ubicacion_geo IS NOT NULL;
    `;
    try {
      const eventos = await sequelize.query(query, { type: QueryTypes.SELECT });
      return eventos || [];
    } catch (error) {
      console.error('❌ [ERROR DETECTAR EVENTOS]:', error?.message);
      return [];
    }
  }

  // 3. Motor vectorial masivo (Modelo "Waypoints") - Ultra veloz y realista
  async ejecutarMotorVectorial() {
    const sqlQuery = `
        SET NOCOUNT ON;

        -- 1. Actualizamos el "paso" en la cabeza de los camiones (Si llegan al destino, se devuelven al inicio)
        UPDATE F
        SET F.paso_actual = CASE 
                WHEN F.paso_actual >= R.max_pasos THEN 1 
                ELSE F.paso_actual + 1 
            END
        FROM TLCFlotaTerrestre F
        INNER JOIN TCL_Simulador_Rutas R ON F.id_ruta = R.id_ruta
        WHERE F.id_ruta IS NOT NULL;

        -- 2. Teletransportamos la flota masivamente al paso exacto en su ruta y aplicamos rotación
        UPDATE F
        SET 
            F.ubicacion_geo = W.ubicacion_geo,
            F.rumbo = W.rumbo, -- 🟢 Hereda la rotación exacta del waypoint actual
            F.ultima_actualizacion = GETDATE()
        OUTPUT inserted.placa
        FROM TLCFlotaTerrestre F
        INNER JOIN TCL_Simulador_Waypoints W 
            ON F.id_ruta = W.id_ruta AND F.paso_actual = W.paso;
    `;

    try {
      const resultados = await sequelize.query(sqlQuery, { type: QueryTypes.SELECT });
      const filasMovidas = Array.isArray(resultados) ? resultados.length : 0;

      return [[{ FilasMovidas: filasMovidas }]];
    } catch (error) {
      console.error('❌ [ERROR MOTOR WAYPOINTS]:', error?.message);
      return [[{ FilasMovidas: 0 }]];
    }
  }

  // 4. Tablero de KPIs unificado (Terrestre y Marítimo)
  async obtenerGeocercasConKPIs() {
    const query = `
      SELECT 
          g.id_faro, 
          g.nombre_faro, 
          g.radio_metros,
          g.tipo_faro,
          g.descripcion, 
          g.color_ui,
          g.geocerca_geo.STAsText() as wkt,
          
          ISNULL(kpi_camiones.total_camiones, 0) as total_camiones,
          ISNULL(kpi_camiones.en_ruta, 0) as camiones_ruta,
          ISNULL(kpi_camiones.detenidos, 0) as camiones_detenidos,
          
          ISNULL(kpi_naves.total_naves, 0) as total_naves,
          ISNULL(kpi_naves.fondeadas, 0) as fondeadas,
          ISNULL(kpi_naves.avisadas, 0) as avisadas,
          ISNULL(kpi_naves.arribadas, 0) as arribadas,
          
          CASE 
              WHEN (ISNULL(kpi_camiones.total_camiones, 0) + ISNULL(kpi_naves.total_naves, 0)) > 50 THEN 'ROJO'
              WHEN (ISNULL(kpi_camiones.total_camiones, 0) + ISNULL(kpi_naves.total_naves, 0)) > 20 THEN 'AMARILLO'
              ELSE 'VERDE'
          END as estado_kpi

      FROM T_Maestro_Faros g WITH(NOLOCK)
      
      OUTER APPLY (
          SELECT 
              COUNT(DISTINCT c.placa) as total_camiones,
              SUM(CASE WHEN c.estado = 'EN_RUTA' THEN 1 ELSE 0 END) as en_ruta,
              SUM(CASE WHEN c.estado != 'EN_RUTA' THEN 1 ELSE 0 END) as detenidos
          FROM TLCFlotaTerrestre c WITH(NOLOCK) 
          WHERE c.ubicacion_geo IS NOT NULL 
          AND c.ubicacion_geo.STIntersects(g.geocerca_geo) = 1
      ) kpi_camiones
      
      OUTER APPLY (
          SELECT 
              COUNT(DISTINCT ais.mmsi) as total_naves,
              SUM(CASE WHEN perfiles.estado_nave = 'FONDEADAS' THEN 1 ELSE 0 END) as fondeadas,
              SUM(CASE WHEN perfiles.estado_nave = 'AVISADAS' THEN 1 ELSE 0 END) as avisadas,
              SUM(CASE WHEN perfiles.estado_nave = 'ARRIBADAS' THEN 1 ELSE 0 END) as arribadas
          FROM TCLAisUltimaPosicion ais WITH(NOLOCK)
          LEFT JOIN (
              SELECT omi, 'AVISADAS' as estado_nave FROM TLCNaves_Avisadas WITH(NOLOCK) WHERE omi IS NOT NULL
              UNION ALL
              SELECT omi, 'FONDEADAS' as estado_nave FROM TLCNaves_Fondeadas WITH(NOLOCK) WHERE omi IS NOT NULL
              UNION ALL
              SELECT omi, 'ARRIBADAS' as estado_nave FROM TLCNaves_Arribadas WITH(NOLOCK) WHERE omi IS NOT NULL
              UNION ALL
              SELECT omi, 'ZARPADAS' as estado_nave FROM TLCNaves_Zarpadas WITH(NOLOCK) WHERE omi IS NOT NULL
          ) perfiles ON RIGHT(LTRIM(RTRIM(ais.omi)), 6) = LTRIM(RTRIM(perfiles.omi))
          WHERE ais.latitud IS NOT NULL AND ais.longitud IS NOT NULL
          AND geometry::Point(ais.longitud, ais.latitud, 4326).STIntersects(g.geocerca_geo) = 1
      ) kpi_naves
      
      WHERE g.estado = 1;
    `;

    try {
      const [resultados] = await sequelize.query(query);
      return resultados || [];
    } catch (error) {
      console.error('❌ [ERROR KPIS GEOCERCAS]:', error?.message);
      return [];
    }
  }

  // 5. Zonas marítimas
  async obtenerGeocercasMaritimas() {
    const query = `
      SELECT id_faro, nombre_faro, radio_metros, color_ui, descripcion, 
             geocerca_geo.STAsText() as wkt
      FROM T_Maestro_Faros WITH(NOLOCK)
      WHERE tipo_faro = 'MARITIMA' AND estado = 1;
    `;
    try {
      const [resultados] = await sequelize.query(query);
      return resultados || [];
    } catch (error) {
      console.error('❌ [ERROR FAROS MARÍTIMOS]:', error?.message);
      return [];
    }
  }

  // 6. Upsert Atómico por Placa
  async upsertPosicion(dtoData) {
    const { placa, lon, lat, estado, velocidad } = dtoData;
    const query = `
      MERGE INTO TLCFlotaTerrestre AS target
      USING (SELECT :placa AS placa) AS source
      ON (target.placa = source.placa)
      WHEN MATCHED THEN
          UPDATE SET 
              ubicacion_geo = geometry::STPointFromText('POINT(' + CAST(:lon AS VARCHAR(20)) + ' ' + CAST(:lat AS VARCHAR(20)) + ')', 4326),
              ultima_actualizacion = GETDATE(),
              velocidad = :velocidad,
              estado = :estado
      WHEN NOT MATCHED THEN
          INSERT (placa, ubicacion_geo, ultima_actualizacion, velocidad, estado)
          VALUES (:placa, geometry::STPointFromText('POINT(' + CAST(:lon AS VARCHAR(20)) + ' ' + CAST(:lat AS VARCHAR(20)) + ')', 4326), GETDATE(), :velocidad, :estado);
    `;

    return await sequelize.query(query, {
      replacements: {
        placa: placa,
        lon: lon,
        lat: lat,
        velocidad: velocidad || 0,
        estado: estado || 'EN_RUTA'
      },
      type: QueryTypes.RAW
    });
  }
}

module.exports = new FlotaTerrestreRepository();