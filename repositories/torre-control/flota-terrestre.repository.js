/*
    Author: German Dario Valencia Salazar
    Pattern: PORTTOS Repository Pattern - Flota Terrestre (Completo y Sincronizado con Ruteo y Rotación)
*/
const { sequelize } = require('../../models');
const { QueryTypes } = require('sequelize');

class FlotaTerrestreRepository {

  // 1. Obtiene los datos geográficos para el mapa
  /** @param {{sur,oeste,norte,este}|null} caja filtro opcional por puerto (agregado 2026-10-18) */
  async obtenerDatosGeograficosFlota(caja = null) {
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
      FROM TCL_FlotaTerrestre c WITH(NOLOCK)
      LEFT JOIN TCL_MaestroCamiones v WITH(NOLOCK) ON c.placa = v.placa 
      WHERE c.ubicacion_geo IS NOT NULL
      ${caja ? 'AND c.ubicacion_geo.STY BETWEEN :sur AND :norte AND c.ubicacion_geo.STX BETWEEN :oeste AND :este' : ''}
    `;

    try {
      const resultados = await sequelize.query(query, { replacements: caja || {}, type: QueryTypes.SELECT });

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
        FROM TCL_FlotaTerrestre T WITH(NOLOCK)
        INNER JOIN TCL_MaestroFaros G WITH(NOLOCK) 
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

  // 3. Simulador de flota (utils/simulador-flota.js). Reemplaza al motor por waypoints que saltaba un punto por ciclo
  //    (copia en _respaldos/2026-10-19_simulador-flota).

  /** Waypoints de las rutas del simulador, en orden. */
  async rutasSimulador() {
    const filas = await sequelize.query(`
      SELECT W.id_ruta, W.paso, W.ubicacion_geo.STX AS lon, W.ubicacion_geo.STY AS lat
      FROM TCL_SimuladorWaypoints W WITH(NOLOCK)
      WHERE W.ubicacion_geo IS NOT NULL
      ORDER BY W.id_ruta, W.paso`, { type: QueryTypes.SELECT });
    const rutas = new Map();
    for (const f of filas) {
      if (!rutas.has(f.id_ruta)) rutas.set(f.id_ruta, { id: f.id_ruta, puntos: [] });
      rutas.get(f.id_ruta).puntos.push({ paso: Number(f.paso), lon: Number(f.lon), lat: Number(f.lat) });
    }
    return [...rutas.values()];
  }

  /** Camiones del simulador (los que tienen ruta asignada). */
  flotaSimulada() {
    return sequelize.query(`
      SELECT placa, id_ruta, paso_actual
      FROM TCL_FlotaTerrestre WITH(NOLOCK)
      WHERE id_ruta IS NOT NULL`, { type: QueryTypes.SELECT });
  }

  /**
   * Escribe posición, rumbo, velocidad, estado y paso de los camiones simulados.
   * Lotes de 300 filas × 7 parámetros (tope de SQL Server: 2100). Sin OPENJSON: la base está en nivel 110.
   */
  async actualizarSimulacion(filas) {
    let total = 0;
    for (let i = 0; i < filas.length; i += 300) {
      const lote = filas.slice(i, i + 300);
      const r = {};
      const valores = lote.map((f, j) => {
        Object.assign(r, { [`pl${j}`]: f.placa, [`lo${j}`]: f.lon, [`la${j}`]: f.lat, [`ru${j}`]: f.rumbo,
          [`ve${j}`]: f.velocidad, [`es${j}`]: f.estado, [`pa${j}`]: f.paso });
        return `(:pl${j}, :lo${j}, :la${j}, :ru${j}, :ve${j}, :es${j}, :pa${j})`;
      });
      await sequelize.query(`
        UPDATE F SET
          F.ubicacion_geo = geometry::Point(V.lon, V.lat, 4326),
          F.rumbo = V.rumbo, F.velocidad = V.velocidad, F.estado = LEFT(V.estado, 20), F.paso_actual = V.paso,
          F.ultima_actualizacion = GETDATE()
        FROM TCL_FlotaTerrestre F
        INNER JOIN (VALUES ${valores.join(', ')}) AS V (placa, lon, lat, rumbo, velocidad, estado, paso) ON F.placa = V.placa`,
      { replacements: r, type: QueryTypes.UPDATE });
      total += lote.length;
    }
    return total;
  }

  /**
   * Reemplaza los waypoints de una ruta del simulador por la geometría ajustada a la red vial
   * (scripts/rutas-simulador.js). En una transacción:
   *   1. la primera vez copia la tabla completa a TCL_SimuladorWaypoints_respaldo (reversible);
   *   2. borra e inserta los waypoints (lotes de 400 × 5 parámetros);
   *   3. actualiza max_pasos y lleva el paso_actual de los camiones a la misma proporción del recorrido.
   * @param {number} idRuta
   * @param {Array<{lon:number, lat:number, rumbo:number}>} puntos
   */
  async reemplazarRutaSimulador(idRuta, puntos) {
    return sequelize.transaction(async (transaction) => {
      const q = (sql, replacements = {}, type = QueryTypes.RAW) => sequelize.query(sql, { replacements, type, transaction });
      await q(`IF OBJECT_ID(N'dbo.TCL_SimuladorWaypoints_respaldo', N'U') IS NULL
                 SELECT * INTO dbo.TCL_SimuladorWaypoints_respaldo FROM dbo.TCL_SimuladorWaypoints;`);
      const [{ maxAnterior }] = await q(
        'SELECT ISNULL(MAX(paso), 0) AS maxAnterior FROM TCL_SimuladorWaypoints WHERE id_ruta = :idRuta',
        { idRuta }, QueryTypes.SELECT);
      await q('DELETE FROM TCL_SimuladorWaypoints WHERE id_ruta = :idRuta', { idRuta });
      for (let i = 0; i < puntos.length; i += 400) {
        const r = { idRuta };
        const valores = puntos.slice(i, i + 400).map((p, j) => {
          Object.assign(r, { [`pa${j}`]: i + j + 1, [`lo${j}`]: p.lon, [`la${j}`]: p.lat, [`ru${j}`]: p.rumbo });
          return `(:idRuta, :pa${j}, geometry::Point(:lo${j}, :la${j}, 4326), :ru${j})`;
        });
        await q(`INSERT INTO TCL_SimuladorWaypoints (id_ruta, paso, ubicacion_geo, rumbo) VALUES ${valores.join(', ')}`, r, QueryTypes.INSERT);
      }
      await q('UPDATE TCL_SimuladorRutas SET max_pasos = :n WHERE id_ruta = :idRuta', { idRuta, n: puntos.length }, QueryTypes.UPDATE);
      if (maxAnterior > 0) {
        await q(`UPDATE TCL_FlotaTerrestre
                 SET paso_actual = CASE WHEN CEILING(paso_actual * 1.0 * :n / :maxAnterior) < 1 THEN 1
                                        WHEN CEILING(paso_actual * 1.0 * :n / :maxAnterior) > :n THEN :n
                                        ELSE CEILING(paso_actual * 1.0 * :n / :maxAnterior) END
                 WHERE id_ruta = :idRuta`, { idRuta, n: puntos.length, maxAnterior }, QueryTypes.UPDATE);
      }
      return { idRuta, pasosAnteriores: maxAnterior, pasosNuevos: puntos.length };
    });
  }

  // 4. Tablero de KPIs unificado (Terrestre y Marítimo)
  /** @param {string|null} cajaWkt POLYGON de la caja del puerto: solo geocercas que la tocan (agregado 2026-10-18) */
  async obtenerGeocercasConKPIs(cajaWkt = null) {
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

      FROM TCL_MaestroFaros g WITH(NOLOCK)
      
      OUTER APPLY (
          SELECT 
              COUNT(DISTINCT c.placa) as total_camiones,
              SUM(CASE WHEN c.estado = 'EN_RUTA' THEN 1 ELSE 0 END) as en_ruta,
              SUM(CASE WHEN c.estado != 'EN_RUTA' THEN 1 ELSE 0 END) as detenidos
          FROM TCL_FlotaTerrestre c WITH(NOLOCK) 
          WHERE c.ubicacion_geo IS NOT NULL 
          AND c.ubicacion_geo.STIntersects(g.geocerca_geo) = 1
      ) kpi_camiones
      
      OUTER APPLY (
          SELECT 
              COUNT(DISTINCT ais.mmsi) as total_naves,
              SUM(CASE WHEN perfiles.estado_nave = 'FONDEADAS' THEN 1 ELSE 0 END) as fondeadas,
              SUM(CASE WHEN perfiles.estado_nave = 'AVISADAS' THEN 1 ELSE 0 END) as avisadas,
              SUM(CASE WHEN perfiles.estado_nave = 'ARRIBADAS' THEN 1 ELSE 0 END) as arribadas
          FROM TCL_AisUltimaPosicion ais WITH(NOLOCK)
          LEFT JOIN (
              SELECT omi, 'AVISADAS' as estado_nave FROM TCL_NavesAvisadas WITH(NOLOCK) WHERE omi IS NOT NULL
              UNION ALL
              SELECT omi, 'FONDEADAS' as estado_nave FROM TCL_NavesFondeadas WITH(NOLOCK) WHERE omi IS NOT NULL
              UNION ALL
              SELECT omi, 'ARRIBADAS' as estado_nave FROM TCL_NavesArribadas WITH(NOLOCK) WHERE omi IS NOT NULL
              UNION ALL
              SELECT omi, 'ZARPADAS' as estado_nave FROM TCL_NavesZarpadas WITH(NOLOCK) WHERE omi IS NOT NULL
          ) perfiles ON RIGHT(LTRIM(RTRIM(ais.omi)), 6) = LTRIM(RTRIM(perfiles.omi))
          WHERE ais.latitud IS NOT NULL AND ais.longitud IS NOT NULL
          AND geometry::Point(ais.longitud, ais.latitud, 4326).STIntersects(g.geocerca_geo) = 1
      ) kpi_naves
      
      WHERE g.estado = 1
      ${cajaWkt ? 'AND g.geocerca_geo IS NOT NULL AND g.geocerca_geo.STIntersects(geometry::STGeomFromText(:cajaWkt, 4326)) = 1' : ''};
    `;

    try {
      const [resultados] = await sequelize.query(query, { replacements: cajaWkt ? { cajaWkt } : {} });
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
      FROM TCL_MaestroFaros WITH(NOLOCK)
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
      MERGE INTO TCL_FlotaTerrestre AS target
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