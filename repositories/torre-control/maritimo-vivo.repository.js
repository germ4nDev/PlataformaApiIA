/*
    Author: German Valencia
    Pattern: PORTTOS Repository - KPIs marítimos en vivo (estado AIS)
    Description: Lecturas sobre el estado que escribe el motor AIS (ais-stream.service.js).
      Requiere la migración 005 (id_puerto, estado_inferido, fecha_cambio_estado y TCL_EventosEstadoNave);
      la 006 (capitania_dimar) es opcional: sin ella los avisos DIMAR se cruzan por nombre.
      Fechas: NVARCHAR(100) ISO UTC → TRY_CONVERT(DATETIMEOFFSET, x, 127). Todo va con replacements (ojo: Sequelize no reemplaza ":x" precedido de "-";
      por eso los desplazamientos negativos se pasan ya negados: vigenciaNeg, horasAtrasNeg).
*/
const { QueryTypes } = require('sequelize');
const { FECHA_LINEUP } = require('./maritimo.repository');
const { db } = require('../../database/connection');
const { esColumnaInexistente, esTablaInexistente, migracionPendiente } = require('../../helpers/errores.helper');

const VIGENTE = `TRY_CONVERT(DATETIMEOFFSET, fechaModificacion, 127) >= DATEADD(MINUTE, :vigenciaNeg, SYSDATETIMEOFFSET())`;
const MINUTOS_EN_ESTADO = `DATEDIFF(MINUTE, TRY_CONVERT(DATETIMEOFFSET, fecha_cambio_estado, 127), SYSDATETIMEOFFSET())`;
const MIGRACION_005 = '005_ais_estado_navegacion.sql';

/** Evita que %, _ o [ en un nombre actúen como comodines de LIKE. */
const escaparLike = (texto) => String(texto || '').trim().replace(/[[%_]/g, (c) => `[${c}]`);

class MaritimoVivoRepository {
  async _select(sql, replacements) {
    try {
      return await db.sequelize.query(sql, { replacements, type: QueryTypes.SELECT });
    } catch (error) {
      if (esColumnaInexistente(error) || esTablaInexistente(error)) throw migracionPendiente(MIGRACION_005);
      throw error;
    }
  }

  /** Acepta el id o el nombre del puerto ("BUENAVENTURA", "SANTA_MARTA"), sin tildes ni mayúsculas. */
  async buscarPuerto(clave) {
    const consulta = (conCapitania) => db.sequelize.query(`
      SELECT TOP (1) CAST(id_puerto AS NVARCHAR(50)) AS idPuerto, nombre
             ${conCapitania ? ', capitania_dimar AS capitaniaDimar' : ''}
      FROM dbo.TCL_MaestroPuertos
      WHERE REPLACE(UPPER(LTRIM(RTRIM(id_puerto))), ' ', '_') COLLATE Latin1_General_CI_AI = :clave
         OR REPLACE(UPPER(LTRIM(RTRIM(nombre))), ' ', '_') COLLATE Latin1_General_CI_AI = :clave`,
      { replacements: { clave }, type: QueryTypes.SELECT });
    try {
      return (await consulta(true))[0] || null;
    } catch (error) {
      if (esColumnaInexistente(error)) return (await consulta(false))[0] || null; // sin la migración 006
      throw error;
    }
  }

  estadosActuales(idPuerto, vigenciaMin) {
    return this._select(`
      WITH vigentes AS (
        SELECT estado_inferido, ${MINUTOS_EN_ESTADO} AS minutos
        FROM dbo.TCL_AisUltimaPosicion
        WHERE id_puerto = :idPuerto AND ${VIGENTE}
      )
      SELECT estado_inferido AS estado, COUNT(*) AS naves,
             AVG(CAST(minutos AS FLOAT)) AS minutosPromedio, MAX(minutos) AS minutosMaximo
      FROM vigentes
      GROUP BY estado_inferido`, { idPuerto, vigenciaNeg: -vigenciaMin });
  }

  colaFondeo(idPuerto, vigenciaMin, limite) {
    return this._select(`
      SELECT TOP (:limite)
             CAST(mmsi AS NVARCHAR(20)) AS mmsi, nombre_motonave AS nombre, destino,
             CAST(latitud AS FLOAT) AS latitud, CAST(longitud AS FLOAT) AS longitud,
             ${MINUTOS_EN_ESTADO} AS minutos
      FROM dbo.TCL_AisUltimaPosicion
      WHERE id_puerto = :idPuerto AND estado_inferido = 'FONDEADO' AND ${VIGENTE}
      ORDER BY minutos DESC`, { idPuerto, vigenciaNeg: -vigenciaMin, limite });
  }

  /** FONDEADO → (EN MANIOBRA | ATRACADO): espera en fondeo, con la terminal donde atracó en las 12 h siguientes. */
  eventosFondeo(idPuerto, desdeIso) {
    return this._select(`
      SELECT TOP (20000)
             e.mmsi, e.duracion_anterior_min AS minutos, e.fecha_evento AS fechaEvento, atraque.id_terminal AS idTerminal
      FROM dbo.TCL_EventosEstadoNave e
      OUTER APPLY (
        SELECT TOP (1) x.id_terminal
        FROM dbo.TCL_EventosEstadoNave x
        WHERE x.mmsi = e.mmsi AND x.estado_nuevo = 'ATRACADO' AND x.fecha_evento >= e.fecha_evento
          AND TRY_CONVERT(DATETIMEOFFSET, x.fecha_evento, 127)
              <= DATEADD(HOUR, 12, TRY_CONVERT(DATETIMEOFFSET, e.fecha_evento, 127))
        ORDER BY x.fecha_evento
      ) atraque
      WHERE e.id_puerto = :idPuerto
        AND e.estado_anterior = 'FONDEADO'
        AND e.estado_nuevo IN ('EN MANIOBRA', 'ATRACADO')
        AND e.duracion_anterior_min IS NOT NULL
        AND e.fecha_evento >= :desde
      ORDER BY e.fecha_evento`, { idPuerto, desde: desdeIso });
  }

  /** ATRACADO → otro estado: estadía en muelle, con el muelle del último atraque. */
  eventosEstadia(idPuerto, desdeIso) {
    return this._select(`
      SELECT TOP (20000)
             e.mmsi, e.duracion_anterior_min AS minutos, e.fecha_evento AS fechaEvento,
             COALESCE(atraque.id_terminal, e.id_terminal) AS idTerminal,
             COALESCE(atraque.codigo_muelle, e.codigo_muelle) AS codigoMuelle
      FROM dbo.TCL_EventosEstadoNave e
      OUTER APPLY (
        SELECT TOP (1) x.id_terminal, x.codigo_muelle
        FROM dbo.TCL_EventosEstadoNave x
        WHERE x.mmsi = e.mmsi AND x.estado_nuevo = 'ATRACADO' AND x.fecha_evento <= e.fecha_evento
        ORDER BY x.fecha_evento DESC
      ) atraque
      WHERE e.id_puerto = :idPuerto
        AND e.estado_anterior = 'ATRACADO'
        AND e.duracion_anterior_min IS NOT NULL
        AND e.fecha_evento >= :desde
      ORDER BY e.fecha_evento`, { idPuerto, desde: desdeIso });
  }

  async muellesDelPuerto(idPuerto) {
    const filas = await this._select(`
      SELECT m.codigo_muelle AS codigoMuelle, m.id_terminal AS idTerminal, t.nombre AS terminal,
             m.especialidad, CAST(m.calado_metros AS FLOAT) AS caladoMetros,
             CAST(ISNULL(m.estado_mantenimiento, 0) AS BIT) AS enMantenimiento
      FROM dbo.TCL_MaestroMuelles m
      INNER JOIN dbo.TCL_MaestroTerminales t ON t.id_terminal = m.id_terminal
      WHERE t.id_puerto = :idPuerto AND (t.estado = 1 OR t.estado IS NULL)
      ORDER BY t.nombre, m.codigo_muelle`, { idPuerto });
    return filas.map((f) => ({ ...f, enMantenimiento: Boolean(f.enMantenimiento) }));
  }

  /** Naves con reporte AIS vigente en la zona del puerto, con su estado y posición (embudo de llegada). */
  navesEnPuerto(idPuerto, vigenciaMin) {
    return this._select(`
      SELECT CAST(mmsi AS NVARCHAR(20)) AS mmsi, nombre_motonave AS nombre, estado_inferido AS estado,
             CAST(latitud AS FLOAT) AS latitud, CAST(longitud AS FLOAT) AS longitud, CAST(velocidad AS FLOAT) AS velocidad,
             id_terminal AS idTerminal, codigo_muelle AS codigoMuelle, ${MINUTOS_EN_ESTADO} AS minutos
      FROM dbo.TCL_AisUltimaPosicion
      WHERE id_puerto = :idPuerto AND ${VIGENTE}`, { idPuerto, vigenciaNeg: -vigenciaMin });
  }

  /** Muelles del puerto con su polígono (WKT) para el mapa de estado de muelles. */
  muellesConGeometria(idPuerto) {
    return this._select(`
      SELECT m.id_interno AS idInterno, m.codigo_muelle AS codigoMuelle, m.id_terminal AS idTerminal, t.nombre AS terminal,
             m.especialidad, CAST(m.calado_metros AS FLOAT) AS caladoMetros,
             CAST(ISNULL(m.estado_mantenimiento, 0) AS BIT) AS enMantenimiento,
             m.geocerca_geo.STAsText() AS wkt
      FROM dbo.TCL_MaestroMuelles m
      INNER JOIN dbo.TCL_MaestroTerminales t ON t.id_terminal = m.id_terminal
      WHERE t.id_puerto = :idPuerto AND (t.estado = 1 OR t.estado IS NULL)
      ORDER BY t.nombre, m.codigo_muelle`, { idPuerto });
  }

  /**
   * Line-up vigente del puerto: barcos atracados ahora (por estado, igual que el resumen de terminales)
   * y atraques programados en las próximas :horas. Fechas del line-up en formatos mixtos → FECHA_LINEUP.
   */
  lineUpDelPuerto(puerto, horas) {
    const f = (c) => FECHA_LINEUP(c);
    return this._select(`
      SELECT L.terminal AS terminal, L.muelle AS muelle, L.motonave AS motonave,
             TRY_CAST(L.eslora AS FLOAT) AS eslora, L.posicion AS posicion, L.trabajoOperacion AS trabajo,
             L.fechaAtraque AS fechaAtraque, L.fechaZarpe AS fechaZarpe,
             CASE WHEN ${f('L.fechaAtraque')} <= GETDATE()
                    OR (NULLIF(LTRIM(RTRIM(L.fechaAtraque)), '') IS NULL
                        AND (UPPER(L.posicion) LIKE '%ATRAC%' OR UPPER(L.trabajoOperacion) LIKE '%CARGA%'))
                  THEN 1 ELSE 0 END AS atracada,
             DATEDIFF(MINUTE, GETDATE(), ${f('L.fechaAtraque')}) AS minutosParaAtraque
      FROM dbo.TCL_LineUpMaritimo L
      WHERE (UPPER(L.puerto) LIKE UPPER(:puertoNombre) OR UPPER(L.puerto) LIKE UPPER(:puertoId))
        AND COALESCE(L.estadoRegistro, 1) = 1
        AND NULLIF(LTRIM(RTRIM(L.muelle)), '') IS NOT NULL
        AND (NULLIF(LTRIM(RTRIM(L.fechaZarpe)), '') IS NULL OR ${f('L.fechaZarpe')} > GETDATE())
        AND (
              ${f('L.fechaAtraque')} <= DATEADD(HOUR, :horas, GETDATE())
           OR (NULLIF(LTRIM(RTRIM(L.fechaAtraque)), '') IS NULL
               AND (UPPER(L.posicion) LIKE '%ATRAC%' OR UPPER(L.trabajoOperacion) LIKE '%CARGA%'))
        )`, { puertoNombre: `%${(puerto.nombre || '').trim()}%`, puertoId: `%${(puerto.idPuerto || '').trim()}%`, horas });
  }

  navesAtracadas(idPuerto, vigenciaMin) {
    return this._select(`
      SELECT CAST(mmsi AS NVARCHAR(20)) AS mmsi, nombre_motonave AS nombre,
             id_terminal AS idTerminal, codigo_muelle AS codigoMuelle, ${MINUTOS_EN_ESTADO} AS minutos
      FROM dbo.TCL_AisUltimaPosicion
      WHERE id_puerto = :idPuerto AND estado_inferido = 'ATRACADO' AND ${VIGENTE}`, { idPuerto, vigenciaNeg: -vigenciaMin });
  }

  /** Avisos DIMAR de la capitanía del puerto con ETA en la ventana, aún no arribados, cruzados con AIS. */
  avisosLlegada(puerto, horasAtras, horasAdelante, limite) {
    const capitania = (puerto.capitaniaDimar || '').trim() || null;
    return this._select(`
      SELECT TOP (:limite)
             a.id_aviso AS idAviso, a.motonave, a.omi, a.bandera, a.tipo_nave AS tipoNave,
             CAST(a.eslora AS FLOAT) AS eslora, CAST(a.calado AS FLOAT) AS calado,
             a.agencia, a.instalacion_portuaria AS instalacion, a.eta,
             DATEDIFF(MINUTE, SYSDATETIMEOFFSET(), TRY_CONVERT(DATETIMEOFFSET, a.eta, 127)) AS minutosParaEta,
             hom.mmsi, ais.estado_inferido AS estadoAis, ais.id_puerto AS puertoAis,
             CAST(ais.latitud AS FLOAT) AS latitud, CAST(ais.longitud AS FLOAT) AS longitud,
             CAST(ais.velocidad AS FLOAT) AS velocidad,
             DATEDIFF(MINUTE, TRY_CONVERT(DATETIMEOFFSET, ais.fechaModificacion, 127), SYSDATETIMEOFFSET()) AS minutosDesdeAis
      FROM dbo.TCL_NavesAvisadas a
      OUTER APPLY (
        SELECT TOP (1) CAST(h.mmsi AS NVARCHAR(20)) AS mmsi
        FROM dbo.TCL_HomologacionMMSI h
        WHERE CAST(h.id_aviso AS NVARCHAR(100)) = a.id_aviso AND h.mmsi IS NOT NULL
      ) hom
      LEFT JOIN dbo.TCL_AisUltimaPosicion ais ON CAST(ais.mmsi AS NVARCHAR(20)) = hom.mmsi
      WHERE TRY_CONVERT(DATETIMEOFFSET, a.eta, 127)
              BETWEEN DATEADD(HOUR, :horasAtrasNeg, SYSDATETIMEOFFSET()) AND DATEADD(HOUR, :horasAdelante, SYSDATETIMEOFFSET())
        AND (
          (:capitania IS NOT NULL AND a.capitania COLLATE Latin1_General_CI_AI = :capitania)
          OR (:capitania IS NULL AND (a.capitania COLLATE Latin1_General_CI_AI LIKE :patronNombre
                                      OR a.capitania COLLATE Latin1_General_CI_AI LIKE :patronId))
        )
        AND NOT EXISTS (SELECT 1 FROM dbo.TCL_NavesArribadas r WHERE CAST(r.id_aviso AS NVARCHAR(100)) = a.id_aviso)
      ORDER BY TRY_CONVERT(DATETIMEOFFSET, a.eta, 127)`, {
      limite, horasAtrasNeg: -horasAtras, horasAdelante, capitania,
      patronNombre: `%${escaparLike(puerto.nombre)}%`,
      patronId: `%${escaparLike(String(puerto.idPuerto).replace(/_/g, ' '))}%`,
    });
  }
}

module.exports = new MaritimoVivoRepository();
module.exports.MaritimoVivoRepository = MaritimoVivoRepository;
module.exports.escaparLike = escaparLike;
