// /*
//     Author: German Dario Valencia Salazar
//     Pattern: QPLUS Repository Pattern - Flota Terrestre
//     Optimización: Migración a T_Maestro_Faros, uso de STIntersects y Legacy Bridge Histórico
// */
// const { sequelize } = require('../../models');

// class FlotaTerrestreRepository {

//   // 1. Obtiene los datos crudos para el mapa
//   async obtenerDatosGeograficosFlota() {
//     const query = `
//       SELECT 
//         -- 1. Identificadores y Coordenadas
//         c.id AS _id, 
//         c.ubicacion_geo.STX AS lon,
//         c.ubicacion_geo.STY AS lat,

//         -- 2. Datos Operativos (De la tabla actual)
//         c.nombre AS conductor,
//         c.telefono,
//         c.transportadora,
//         c.estado,
//         c.updated_at AS ultima_actualizacion,
//         c.velocidad,

//         -- 3. Datos del Vehículo (Vienen del JOIN)
//         v.placa,
//         v.tipo_camion,
//         v.modelo

//       FROM TCL_CamionesOperaciones c WITH(NOLOCK)

//       -- 👇 AQUÍ HACEMOS EL CRUCE CON LA TABLA DE CAMIONES
//       LEFT JOIN T_Maestro_Camiones v WITH(NOLOCK) 
//       ON c.placa = v.placa 

//       WHERE c.ubicacion_geo IS NOT NULL
//     `;

//     try {
//       const [resultados] = await sequelize.query(query);
//       return resultados || [];
//     } catch (error) {
//       console.error('❌ [ERROR DATOS FLOTA]:', error?.message);
//       return [];
//     }
//   }

//   // 2. Detectar eventos en tiempo real con polígonos
//   async detectarEventosGeocerca(offset = 0, batchSize = 1000) {
//     const query = `
//         WITH Lote AS (
//             SELECT placa, ubicacion_geo 
//             FROM TCL_CamionesOperaciones WITH(NOLOCK)
//             WHERE estado_camion = 'EN_RUTA' AND ubicacion_geo IS NOT NULL
//             ORDER BY id ASC
//             OFFSET ${offset} ROWS FETCH NEXT ${batchSize} ROWS ONLY
//         )
//         SELECT T.placa, G.nombre_faro AS Lugar, G.tipo_faro AS tipo, GETDATE() AS FechaEvento
//         FROM Lote T
//         INNER JOIN T_Maestro_Faros G WITH(NOLOCK) 
//             -- 🟢 OPTIMIZACIÓN: Intersección espacial directa de SQL Server
//             ON T.ubicacion_geo.STIntersects(G.geometria_ubicacion) = 1
//         WHERE G.estado = 1;
//     `;
//     try {
//       const [eventos] = await sequelize.query(query);
//       return eventos || [];
//     } catch (error) {
//       console.error('❌ [ERROR DETECTAR EVENTOS FAROS]:', error?.message || error);
//       return [];
//     }
//   }

//   // 3. Ejecuta la simulación matemática en SQL Server (Motor Vectorial)
//   async ejecutarMotorVectorial(offset, batchSize) {
//     const sqlQuery = `
//         SET NOCOUNT ON;

//         DECLARE @LoteCamiones TABLE (
//             id NVARCHAR(50), 
//             placa VARCHAR(50),
//             ubicacion_geo geometry,
//             punto_destino geometry,
//             velocidad FLOAT
//         );

//         INSERT INTO @LoteCamiones (id, placa, ubicacion_geo, punto_destino, velocidad)
//         SELECT id, placa, ubicacion_geo, punto_destino, velocidad
//         FROM TCL_CamionesOperaciones WITH (ROWLOCK, READPAST)
//         WHERE estado_camion = 'EN_RUTA' 
//           AND ubicacion_geo IS NOT NULL 
//           AND punto_destino IS NOT NULL
//         ORDER BY id ASC
//         OFFSET ${offset} ROWS FETCH NEXT ${batchSize} ROWS ONLY;

//         UPDATE T
//         SET
//             ubicacion_geo = CASE
//                 WHEN (T.velocidad * 0.000556 * 0.008983) >= SQRT(SQUARE(T.punto_destino.STX - T.ubicacion_geo.STX) + SQUARE(T.punto_destino.STY - T.ubicacion_geo.STY)) 
//                      THEN T.punto_destino
//                 WHEN ViaCercana.PuntoAsfalto IS NOT NULL THEN ViaCercana.PuntoAsfalto
//                 ELSE ISNULL(geometry::Point(
//                     T.ubicacion_geo.STX + ( (T.punto_destino.STX - T.ubicacion_geo.STX) / NULLIF(SQRT(SQUARE(T.punto_destino.STX - T.ubicacion_geo.STX) + SQUARE(T.punto_destino.STY - T.ubicacion_geo.STY)), 0) ) * (T.velocidad * 0.000556 * 0.008983),
//                     T.ubicacion_geo.STY + ( (T.punto_destino.STY - T.ubicacion_geo.STY) / NULLIF(SQRT(SQUARE(T.punto_destino.STY - T.ubicacion_geo.STY)), 0) ) * (T.velocidad * 0.000556 * 0.008983),
//                     4326), T.ubicacion_geo)
//             END,
//             estado_camion = 'EN_RUTA',
//             velocidad = 60
//         FROM TCL_CamionesOperaciones T
//         INNER JOIN @LoteCamiones LC ON T.id = LC.id
//         OUTER APPLY (
//             SELECT TOP 1 T.ubicacion_geo.ShortestLineTo(R.geometria_via).STEndPoint() AS PuntoAsfalto
//             FROM TCL_RedVial R WITH(INDEX(IX_RedVial_Geometria), ROWLOCK, READPAST)
//             WHERE R.geometria_via.STDistance(T.ubicacion_geo) < 0.0005
//             ORDER BY R.geometria_via.STDistance(T.ubicacion_geo) ASC
//         ) ViaCercana;

//         -- 🟢 LEGACY BRIDGE: Guardamos id_faro en la columna antigua id_geocerca
//         INSERT INTO TCL_HistoricoEventos (placa, id_geocerca, tipo_evento)
//         SELECT LC.placa, G.id_faro, 'ENTRADA'
//         FROM @LoteCamiones LC
//         INNER JOIN T_Maestro_Faros G ON LC.ubicacion_geo.STIntersects(G.geometria_ubicacion) = 1
//         WHERE G.estado = 1 AND NOT EXISTS (
//             SELECT 1 FROM TCL_HistoricoEventos H 
//             WHERE H.placa = LC.placa 
//               AND H.id_geocerca = G.id_faro -- Empalme de compatibilidad
//               AND H.fecha_evento > DATEADD(minute, -30, GETDATE())
//         );

//         SELECT @@ROWCOUNT AS FilasMovidas;
//     `;

//     try {
//       const resultados = await sequelize.query(sqlQuery, { timeout: 60000 });
//       if (resultados && Array.isArray(resultados) && resultados[0]) {
//         return resultados;
//       }
//       return [[{ FilasMovidas: 0 }]];
//     } catch (error) {
//       console.error('❌ [ERROR MOTOR SQL - Lote ' + offset + ']:', error?.message || error);
//       return [[{ FilasMovidas: 0 }]];
//     }
//   }

//   // 4. Tablero de KPIs unificado (Terrestre y Marítimo)
//   async obtenerGeocercasConKPIs() {
//     // const query = `
//     //   SELECT 
//     //       g.id_faro, 
//     //       g.nombre_faro, 
//     //       g.radio_metros,
//     //       g.tipo_faro,
//     //       g.descripcion, 
//     //       g.color_ui,
//     //       g.geometria_ubicacion.STAsText() as wkt,

//     //       -- KPIs Terrestres
//     //       ISNULL(kpi_camiones.total_camiones, 0) as total_camiones,
//     //       ISNULL(kpi_camiones.en_ruta, 0) as camiones_ruta,
//     //       ISNULL(kpi_camiones.detenidos, 0) as camiones_detenidos,

//     //       -- KPIs Marítimos
//     //       ISNULL(kpi_naves.total_naves, 0) as total_naves,
//     //       ISNULL(kpi_naves.fondeadas, 0) as naves_fondeadas,
//     //       ISNULL(kpi_naves.avisadas, 0) as naves_avisadas,
//     //       ISNULL(kpi_naves.arribadas, 0) as naves_arribadas,

//     //       CASE 
//     //           WHEN (ISNULL(kpi_camiones.total_camiones, 0) + ISNULL(kpi_naves.total_naves, 0)) > 50 THEN 'ROJO'
//     //           WHEN (ISNULL(kpi_camiones.total_camiones, 0) + ISNULL(kpi_naves.total_naves, 0)) > 20 THEN 'AMARILLO'
//     //           ELSE 'VERDE'
//     //       END as estado_kpi

//     //   FROM T_Maestro_Faros g WITH(NOLOCK)

//     //   -- 🚛 1. BÚSQUEDA TERRESTRE
//     //   OUTER APPLY (
//     //       SELECT 
//     //           COUNT(DISTINCT c.placa) as total_camiones,
//     //           SUM(CASE WHEN c.estado_camion = 'EN_RUTA' THEN 1 ELSE 0 END) as en_ruta,
//     //           SUM(CASE WHEN c.estado_camion != 'EN_RUTA' THEN 1 ELSE 0 END) as detenidos
//     //       FROM TCL_CamionesOperaciones c WITH(NOLOCK) 
//     //       WHERE c.ubicacion_geo IS NOT NULL 
//     //       AND c.ubicacion_geo.STIntersects(g.geometria_ubicacion) = 1
//     //   ) kpi_camiones

//     //   -- 🚢 2. BÚSQUEDA MARÍTIMA
//     //   OUTER APPLY (
//     //       SELECT 
//     //           COUNT(DISTINCT ais.mmsi) as total_naves,
//     //           SUM(CASE WHEN perfiles.estado_nave = 'FONDEADAS' THEN 1 ELSE 0 END) as fondeadas,
//     //           SUM(CASE WHEN perfiles.estado_nave = 'AVISADAS' THEN 1 ELSE 0 END) as avisadas,
//     //           SUM(CASE WHEN perfiles.estado_nave = 'ARRIBADAS' THEN 1 ELSE 0 END) as arribadas
//     //       FROM TCLAisUltimaPosicion ais WITH(NOLOCK)
//     //       LEFT JOIN (
//     //           SELECT motonave, 'AVISADAS' as estado_nave FROM TLCNaves_Avisadas WITH(NOLOCK)
//     //           UNION ALL
//     //           SELECT motonave, 'FONDEADAS' as estado_nave FROM TLCNaves_Fondeadas WITH(NOLOCK)
//     //           UNION ALL
//     //           SELECT motonave, 'ARRIBADAS' as estado_nave FROM TLCNaves_Arribadas WITH(NOLOCK)
//     //           UNION ALL
//     //           SELECT motonave, 'ZARPADAS' as estado_nave FROM TLCNaves_Zarpadas WITH(NOLOCK)
//     //       ) perfiles 
//     //       ON LTRIM(RTRIM(UPPER(ISNULL(ais.nombre_motonave, '')))) = LTRIM(RTRIM(UPPER(ISNULL(perfiles.motonave, ''))))

//     //       WHERE ais.latitud IS NOT NULL AND ais.longitud IS NOT NULL
//     //       AND geometry::Point(ais.longitud, ais.latitud, 4326).STIntersects(g.geometria_ubicacion) = 1
//     //   ) kpi_naves

//     //   WHERE g.estado = 1;
//     // `;
//     const query = `
//       SELECT 
//           g.id_faro, 
//           g.nombre_faro, 
//           g.radio_metros,
//           g.tipo_faro,
//           g.descripcion, 
//           g.color_ui,
//           g.geocerca_geo.STAsText() as wkt,

//           -- KPIs Terrestres
//           ISNULL(kpi_camiones.total_camiones, 0) as total_camiones,
//           ISNULL(kpi_camiones.en_ruta, 0) as camiones_ruta,
//           ISNULL(kpi_camiones.detenidos, 0) as camiones_detenidos,

//           -- KPIs Marítimos
//           ISNULL(kpi_naves.total_naves, 0) as total_naves,
//           ISNULL(kpi_naves.fondeadas, 0) as naves_fondeadas,
//           ISNULL(kpi_naves.avisadas, 0) as naves_avisadas,
//           ISNULL(kpi_naves.arribadas, 0) as naves_arribadas,

//           CASE 
//               WHEN (ISNULL(kpi_camiones.total_camiones, 0) + ISNULL(kpi_naves.total_naves, 0)) > 50 THEN 'ROJO'
//               WHEN (ISNULL(kpi_camiones.total_camiones, 0) + ISNULL(kpi_naves.total_naves, 0)) > 20 THEN 'AMARILLO'
//               ELSE 'VERDE'
//           END as estado_kpi

//       FROM T_Maestro_Faros g WITH(NOLOCK)

//       -- 🚛 1. BÚSQUEDA TERRESTRE
//       OUTER APPLY (
//           SELECT 
//               COUNT(DISTINCT c.placa) as total_camiones,
//               SUM(CASE WHEN c.estado_camion = 'EN_RUTA' THEN 1 ELSE 0 END) as en_ruta,
//               SUM(CASE WHEN c.estado_camion != 'EN_RUTA' THEN 1 ELSE 0 END) as detenidos
//           FROM TCL_CamionesOperaciones c WITH(NOLOCK) 
//           WHERE c.ubicacion_geo IS NOT NULL 
//           AND c.ubicacion_geo.STIntersects(g.geocerca_geo) = 1
//       ) kpi_camiones

//       -- 🚢 2. BÚSQUEDA MARÍTIMA
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
//           ) perfiles 
//           -- 👇 AQUÍ ESTÁ LA MAGIA: Extraemos los últimos 6 dígitos del AIS
//           ON RIGHT(LTRIM(RTRIM(ais.omi)), 6) = LTRIM(RTRIM(perfiles.omi))

//           WHERE ais.latitud IS NOT NULL AND ais.longitud IS NOT NULL
//           AND geometry::Point(ais.longitud, ais.latitud, 4326).STIntersects(g.geocerca_geo) = 1
//       ) kpi_naves

//       WHERE g.estado = 1;
//     `;

//     try {
//       const [resultados] = await sequelize.query(query);
//       return resultados || [];
//     } catch (error) {
//       console.log("❌ DETALLE OCULTO DE SQL SERVER:");
//       // Los errores agrupados por el driver tedious suelen vivir dentro de la propiedad 'errors'
//       const erroresReales = error.parent?.errors || error.errors || error;
//       console.dir(erroresReales, { depth: null, colors: true });
//     }
//   }

//   // 5. Consulta específica para zonas marítimas puras
//   async obtenerGeocercasMaritimas() {
//     const query = `
//       SELECT id_faro, nombre_faro, radio_metros, color_ui, descripcion, 
//              geometria_ubicacion.STAsText() as wkt
//       FROM T_Maestro_Faros WITH(NOLOCK)
//       WHERE tipo_faro = 'MARITIMA' AND estado = 1;
//     `;
//     try {
//       const [resultados] = await sequelize.query(query);
//       return resultados || [];
//     } catch (error) {
//       console.error('❌ [ERROR OBTENER FAROS MARÍTIMOS]:', error?.message || error);
//       return [];
//     }
//   }

//   async upsertPosicion(dtoData) {
//     return await sequelize.models.TCL_CamionesOperaciones.upsert(dtoData);
//   }
// }

// module.exports = new FlotaTerrestreRepository();

/*
    Author: German Dario Valencia Salazar
    Pattern: QPLUS Repository Pattern - Flota Terrestre
    Optimización: Migración a T_Maestro_Faros, uso de STIntersects y Legacy Bridge Histórico
*/
const { sequelize } = require('../../models');

class FlotaTerrestreRepository {

  // 1. Obtiene los datos crudos para el mapa
  async obtenerDatosGeograficosFlota() {
    const query = `
      SELECT 
        /* 1. Identificadores y Coordenadas */
        c.id AS _id, 
        c.ubicacion_geo.STX AS lon,
        c.ubicacion_geo.STY AS lat,
        
        /* 2. Datos Operativos (De la tabla actual) */
        c.nombre AS conductor,
        c.telefono,
        c.transportadora,
        c.estado,
        c.updated_at AS ultima_actualizacion,
        c.velocidad,

        /* 3. Datos del Vehículo (Vienen del JOIN) */
        v.placa,
        v.tipo_camion,
        v.modelo
        
      FROM TCL_CamionesOperaciones c WITH(NOLOCK)
      
      /* 👇 AQUÍ HACEMOS EL CRUCE CON LA TABLA DE CAMIONES */
      LEFT JOIN T_Maestro_Camiones v WITH(NOLOCK) 
      ON c.placa = v.placa 
      
      WHERE c.ubicacion_geo IS NOT NULL
    `;

    try {
      const [resultados] = await sequelize.query(query);
      return resultados || [];
    } catch (error) {
      console.error('❌ [ERROR DATOS FLOTA]:', error?.message);
      return [];
    }
  }

  // 2. Detectar eventos en tiempo real con polígonos
  // async detectarEventosGeocerca(offset = 0, batchSize = 1000) {
  //   const query = `
  //       ;WITH Lote AS (
  //           SELECT placa, ubicacion_geo 
  //           FROM TCL_CamionesOperaciones WITH(NOLOCK)
  //           WHERE estado_camion = 'EN_RUTA' AND ubicacion_geo IS NOT NULL
  //           ORDER BY id ASC
  //           OFFSET ${offset} ROWS FETCH NEXT ${batchSize} ROWS ONLY
  //       )
  //       SELECT T.placa, G.nombre_faro AS Lugar, G.tipo_faro AS tipo, GETDATE() AS FechaEvento
  //       FROM Lote T
  //       INNER JOIN T_Maestro_Faros G WITH(NOLOCK) 
  //           /* 🟢 OPTIMIZACIÓN: Intersección espacial directa de SQL Server */
  //           ON T.ubicacion_geo.STIntersects(G.geometria_ubicacion) = 1
  //       WHERE G.estado = 1;
  //   `;
  //   try {
  //     const [eventos] = await sequelize.query(query);
  //     return eventos || [];
  //   } catch (error) {
  //     console.error('❌ [ERROR DETECTAR EVENTOS FAROS]:', error?.message || error);
  //     return [];
  //   }
  // }
  async detectarEventosGeocerca(offset = 0, batchSize = 1000) {
    const query = `
        ;WITH Lote AS (
            SELECT placa, ubicacion_geo 
            FROM TCL_CamionesOperaciones WITH(NOLOCK)
            WHERE estado_camion = 'EN_RUTA' AND ubicacion_geo IS NOT NULL
            ORDER BY id ASC
            OFFSET ${offset} ROWS FETCH NEXT ${batchSize} ROWS ONLY
        )
        SELECT T.placa, G.nombre_faro AS Lugar, G.tipo_faro AS tipo, GETDATE() AS FechaEvento
        FROM Lote T
        INNER JOIN T_Maestro_Faros G WITH(NOLOCK) 
            /* 🟢 CORRECCIÓN: Usando la columna geocerca_geo */
            ON T.ubicacion_geo.STIntersects(G.geocerca_geo) = 1
        WHERE G.estado = 1;
    `;
    try {
      const [eventos] = await sequelize.query(query);
      return eventos || [];
    } catch (error) {
      // Desempaquetamos el error real de SQL Server
      const mensajeReal = error.original?.message || error.parent?.message || error.message;
      console.error('❌ [ERROR DETECTAR EVENTOS FAROS]:', mensajeReal);
      return [];
    }
  }

  // 3. Ejecuta la simulación matemática en SQL Server (Motor Vectorial)
  async ejecutarMotorVectorial(offset, batchSize) {
    const sqlQuery = `
        SET NOCOUNT ON;

        DECLARE @LoteCamiones TABLE (
            id NVARCHAR(50), 
            placa VARCHAR(50),
            ubicacion_geo geometry,
            punto_destino geometry,
            velocidad FLOAT
        );

        INSERT INTO @LoteCamiones (id, placa, ubicacion_geo, punto_destino, velocidad)
        SELECT id, placa, ubicacion_geo, punto_destino, velocidad
        FROM TCL_CamionesOperaciones WITH (ROWLOCK, READPAST)
        WHERE estado_camion = 'EN_RUTA' 
          AND ubicacion_geo IS NOT NULL 
          AND punto_destino IS NOT NULL
        ORDER BY id ASC
        OFFSET ${offset} ROWS FETCH NEXT ${batchSize} ROWS ONLY;

        UPDATE T
        SET
            ubicacion_geo = CASE
                WHEN (T.velocidad * 0.000556 * 0.008983) >= SQRT(SQUARE(T.punto_destino.STX - T.ubicacion_geo.STX) + SQUARE(T.punto_destino.STY - T.ubicacion_geo.STY)) 
                     THEN T.punto_destino
                WHEN ViaCercana.PuntoAsfalto IS NOT NULL THEN ViaCercana.PuntoAsfalto
                ELSE ISNULL(geometry::Point(
                    T.ubicacion_geo.STX + ( (T.punto_destino.STX - T.ubicacion_geo.STX) / NULLIF(SQRT(SQUARE(T.punto_destino.STX - T.ubicacion_geo.STX) + SQUARE(T.punto_destino.STY - T.ubicacion_geo.STY)), 0) ) * (T.velocidad * 0.000556 * 0.008983),
                    T.ubicacion_geo.STY + ( (T.punto_destino.STY - T.ubicacion_geo.STY) / NULLIF(SQRT(SQUARE(T.punto_destino.STY - T.ubicacion_geo.STY)), 0) ) * (T.velocidad * 0.000556 * 0.008983),
                    4326), T.ubicacion_geo)
            END,
            estado_camion = 'EN_RUTA',
            velocidad = 60
        FROM TCL_CamionesOperaciones T
        INNER JOIN @LoteCamiones LC ON T.id = LC.id
        OUTER APPLY (
            SELECT TOP 1 T.ubicacion_geo.ShortestLineTo(R.geometria_via).STEndPoint() AS PuntoAsfalto
            FROM TCL_RedVial R WITH(INDEX(IX_RedVial_Geometria), ROWLOCK, READPAST)
            WHERE R.geometria_via.STDistance(T.ubicacion_geo) < 0.0005
            ORDER BY R.geometria_via.STDistance(T.ubicacion_geo) ASC
        ) ViaCercana;

        /* 🟢 LEGACY BRIDGE: Guardamos id_faro en la columna antigua id_geocerca */
        INSERT INTO TCL_HistoricoEventos (placa, id_geocerca, tipo_evento)
        SELECT LC.placa, G.id_faro, 'ENTRADA'
        FROM @LoteCamiones LC
        /* 👇 CORRECCIÓN AQUÍ: geocerca_geo */
        INNER JOIN T_Maestro_Faros G ON LC.ubicacion_geo.STIntersects(G.geocerca_geo) = 1
        WHERE G.estado = 1 AND NOT EXISTS (
            SELECT 1 FROM TCL_HistoricoEventos H 
            WHERE H.placa = LC.placa 
              AND H.id_geocerca = G.id_faro /* Empalme de compatibilidad */
              AND H.fecha_evento > DATEADD(minute, -30, GETDATE())
        );

        SELECT @@ROWCOUNT AS FilasMovidas;
    `;

    try {
      const resultados = await sequelize.query(sqlQuery, { timeout: 60000 });
      if (resultados && Array.isArray(resultados) && resultados[0]) {
        return resultados;
      }
      return [[{ FilasMovidas: 0 }]];
    } catch (error) {
      const mensajeReal = error.original?.message || error.parent?.message || error.message;
      console.error('❌ [ERROR MOTOR SQL - Lote ' + offset + ']:', mensajeReal);
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
          
          /* KPIs Terrestres */
          ISNULL(kpi_camiones.total_camiones, 0) as total_camiones,
          ISNULL(kpi_camiones.en_ruta, 0) as camiones_ruta,
          ISNULL(kpi_camiones.detenidos, 0) as camiones_detenidos,
          
          /* KPIs Marítimos */
          ISNULL(kpi_naves.total_naves, 0) as total_naves,
          ISNULL(kpi_naves.fondeadas, 0) as naves_fondeadas,
          ISNULL(kpi_naves.avisadas, 0) as naves_avisadas,
          ISNULL(kpi_naves.arribadas, 0) as naves_arribadas,
          
          CASE 
              WHEN (ISNULL(kpi_camiones.total_camiones, 0) + ISNULL(kpi_naves.total_naves, 0)) > 50 THEN 'ROJO'
              WHEN (ISNULL(kpi_camiones.total_camiones, 0) + ISNULL(kpi_naves.total_naves, 0)) > 20 THEN 'AMARILLO'
              ELSE 'VERDE'
          END as estado_kpi

      FROM T_Maestro_Faros g WITH(NOLOCK)
      
      /* 🚛 1. BÚSQUEDA TERRESTRE */
      OUTER APPLY (
          SELECT 
              COUNT(DISTINCT c.placa) as total_camiones,
              SUM(CASE WHEN c.estado_camion = 'EN_RUTA' THEN 1 ELSE 0 END) as en_ruta,
              SUM(CASE WHEN c.estado_camion != 'EN_RUTA' THEN 1 ELSE 0 END) as detenidos
          FROM TCL_CamionesOperaciones c WITH(NOLOCK) 
          WHERE c.ubicacion_geo IS NOT NULL 
          AND c.ubicacion_geo.STIntersects(g.geocerca_geo) = 1
      ) kpi_camiones
      
      /* 🚢 2. BÚSQUEDA MARÍTIMA */
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
          ) perfiles 
          /* 👇 AQUÍ ESTÁ LA MAGIA: Extraemos los últimos 6 dígitos del AIS */
          ON RIGHT(LTRIM(RTRIM(ais.omi)), 6) = LTRIM(RTRIM(perfiles.omi))
          
          WHERE ais.latitud IS NOT NULL AND ais.longitud IS NOT NULL
          AND geometry::Point(ais.longitud, ais.latitud, 4326).STIntersects(g.geocerca_geo) = 1
      ) kpi_naves
      
      WHERE g.estado = 1;
    `;

    try {
      const [resultados] = await sequelize.query(query);
      return resultados || [];
    } catch (error) {
      console.log("❌ DETALLE OCULTO DE SQL SERVER:");
      const erroresReales = error.parent?.errors || error.errors || error;
      console.dir(erroresReales, { depth: null, colors: true });
    }
  }

  // 5. Consulta específica para zonas marítimas puras
  // async obtenerGeocercasMaritimas() {
  //   const query = `
  //     SELECT id_faro, nombre_faro, radio_metros, color_ui, descripcion, 
  //            geometria_ubicacion.STAsText() as wkt
  //     FROM T_Maestro_Faros WITH(NOLOCK)
  //     WHERE tipo_faro = 'MARITIMA' AND estado = 1;
  //   `;
  //   try {
  //     const [resultados] = await sequelize.query(query);
  //     return resultados || [];
  //   } catch (error) {
  //     console.error('❌ [ERROR OBTENER FAROS MARÍTIMOS]:', error?.message || error);
  //     return [];
  //   }
  // }
  async obtenerGeocercasMaritimas() {
    const query = `
      SELECT id_faro, nombre_faro, radio_metros, color_ui, descripcion, 
             /* 👇 CORRECCIÓN AQUÍ: geocerca_geo */
             geocerca_geo.STAsText() as wkt
      FROM T_Maestro_Faros WITH(NOLOCK)
      WHERE tipo_faro = 'MARITIMA' AND estado = 1;
    `;
    try {
      const [resultados] = await sequelize.query(query);
      return resultados || [];
    } catch (error) {
      const mensajeReal = error.original?.message || error.parent?.message || error.message;
      console.error('❌ [ERROR OBTENER FAROS MARÍTIMOS]:', mensajeReal);
      return [];
    }
  }

  async upsertPosicion(dtoData) {
    return await sequelize.models.TCL_CamionesOperaciones.upsert(dtoData);
  }
}

module.exports = new FlotaTerrestreRepository();