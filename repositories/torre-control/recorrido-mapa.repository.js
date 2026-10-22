/*
    Author: German Valencia
    Pattern: PORTTOS Repository - Recorrido del mapa (TCL_RecorridoMapa · migración 012)
    Description: Muestreo de posiciones (naves AIS y flota terrestre) y lectura del recorrido para el modo reproducir.
      - posicionesActuales(): lo que hoy está en TCL_AisUltimaPosicion (vigente) y TCL_FlotaTerrestre.
      - guardar(): inserta muestras por lotes (150 filas × 10 parámetros, bajo el tope de 2100 de SQL Server).
      - recorrido(): muestras de una ventana de tiempo dentro de la caja del puerto (naves y camiones con su margen).
      - transiciones(): cambios de estado AIS del puerto en la ventana (TCL_EventosEstadoNave, migración 005).
    Sin la migración 012 lanza migracionPendiente (503); el servicio apaga el muestreo hasta el próximo reinicio.
    Fechas: NVARCHAR(100) ISO UTC; los rangos se comparan como texto (ordenan bien).
*/
const { QueryTypes } = require('sequelize');
const { db } = require('../../database/connection');
const { esColumnaInexistente, esTablaInexistente, migracionPendiente } = require('../../helpers/errores.helper');

const MIGRACION_012 = '012_recorrido_mapa.sql';
const LOTE = 150;

async function ejecutar(sql, replacements = {}, type = QueryTypes.SELECT, migracion = MIGRACION_012) {
  try {
    return await db.sequelize.query(sql, { replacements, type });
  } catch (error) {
    if (esTablaInexistente(error) || esColumnaInexistente(error) || /Invalid object name/i.test(error?.message || '')) {
      throw migracionPendiente(migracion);
    }
    throw error;
  }
}

/** Posiciones actuales de naves (AIS vigente en los últimos :vigenciaMin) y camiones. Formato de muestraValida(). */
async function posicionesActuales(vigenciaMin = 30) {
  const [naves, camiones] = await Promise.all([
    db.sequelize.query(`
      SELECT 'NAVE' AS tipo, CAST(mmsi AS NVARCHAR(20)) AS id, nombre_motonave AS nombre,
             CAST(latitud AS FLOAT) AS latitud, CAST(longitud AS FLOAT) AS longitud,
             CAST(rumbo AS FLOAT) AS rumbo, CAST(velocidad AS FLOAT) AS velocidad, estado_inferido AS estado
      FROM dbo.TCL_AisUltimaPosicion WITH (NOLOCK)
      WHERE latitud IS NOT NULL AND longitud IS NOT NULL
        AND TRY_CONVERT(DATETIMEOFFSET, fechaModificacion, 127) >= DATEADD(MINUTE, :vigenciaNeg, SYSDATETIMEOFFSET())`,
    { replacements: { vigenciaNeg: -Math.abs(vigenciaMin) }, type: QueryTypes.SELECT }),
    db.sequelize.query(`
      SELECT 'CAMION' AS tipo, placa AS id, placa AS nombre,
             ubicacion_geo.STY AS latitud, ubicacion_geo.STX AS longitud,
             CAST(rumbo AS FLOAT) AS rumbo, CAST(velocidad AS FLOAT) AS velocidad, estado
      FROM dbo.TCL_FlotaTerrestre WITH (NOLOCK)
      WHERE ubicacion_geo IS NOT NULL`, { type: QueryTypes.SELECT }),
  ]);
  return [...(naves || []), ...(camiones || [])];
}

/** Inserta muestras ya filtradas (cada una con su fecha ISO). */
async function guardar(muestras) {
  let total = 0;
  for (let i = 0; i < muestras.length; i += LOTE) {
    const lote = muestras.slice(i, i + LOTE);
    const valores = [];
    const r = {};
    lote.forEach((m, j) => {
      valores.push(`(:ti${j}, :id${j}, :no${j}, :la${j}, :lo${j}, :ru${j}, :ve${j}, :es${j}, :fe${j})`);
      Object.assign(r, {
        [`ti${j}`]: m.tipo, [`id${j}`]: m.id, [`no${j}`]: m.nombre, [`la${j}`]: m.latitud, [`lo${j}`]: m.longitud,
        [`ru${j}`]: m.rumbo, [`ve${j}`]: m.velocidad, [`es${j}`]: m.estado, [`fe${j}`]: m.fecha,
      });
    });
    await ejecutar(`
      INSERT INTO dbo.TCL_RecorridoMapa (tipo, id_objeto, nombre, latitud, longitud, rumbo, velocidad, estado, fecha)
      VALUES ${valores.join(', ')}`, r, QueryTypes.INSERT);
    total += lote.length;
  }
  return total;
}

/**
 * Muestras de la ventana [desde, hasta] dentro de las cajas del puerto.
 * @param {{naves:{sur,oeste,norte,este}, camiones:{sur,oeste,norte,este}}} cajas
 */
function recorrido(cajas, desde, hasta) {
  const { naves: n, camiones: c } = cajas;
  return ejecutar(`
    SELECT tipo, id_objeto, nombre, latitud, longitud, rumbo, CAST(velocidad AS FLOAT) AS velocidad, estado, fecha
    FROM dbo.TCL_RecorridoMapa WITH (NOLOCK)
    WHERE fecha >= :desde AND fecha <= :hasta
      AND ((tipo = 'NAVE' AND latitud BETWEEN :nSur AND :nNorte AND longitud BETWEEN :nOeste AND :nEste)
        OR (tipo = 'CAMION' AND latitud BETWEEN :cSur AND :cNorte AND longitud BETWEEN :cOeste AND :cEste))`, {
    desde, hasta,
    nSur: n.sur, nNorte: n.norte, nOeste: n.oeste, nEste: n.este,
    cSur: c.sur, cNorte: c.norte, cOeste: c.oeste, cEste: c.este,
  });
}

/** Cambios de estado AIS del puerto en la ventana (migración 005). */
function transiciones(idPuerto, desde, hasta, limite = 500) {
  return ejecutar(`
    SELECT TOP (:limite) CAST(mmsi AS NVARCHAR(20)) AS mmsi, nombre_motonave AS nombre,
           estado_anterior AS estadoAnterior, estado_nuevo AS estadoNuevo,
           CAST(latitud AS FLOAT) AS latitud, CAST(longitud AS FLOAT) AS longitud, fecha_evento AS fecha
    FROM dbo.TCL_EventosEstadoNave WITH (NOLOCK)
    WHERE id_puerto = :idPuerto AND fecha_evento >= :desde AND fecha_evento <= :hasta
    ORDER BY fecha_evento`, { idPuerto, desde, hasta, limite }, QueryTypes.SELECT, '005_ais_estado_navegacion.sql');
}

/** Borra muestras anteriores a la fecha ISO dada. */
async function purgar(antesDeIso) {
  await ejecutar('DELETE FROM dbo.TCL_RecorridoMapa WHERE fecha < :antes', { antes: antesDeIso }, QueryTypes.DELETE);
}

module.exports = { posicionesActuales, guardar, recorrido, transiciones, purgar, MIGRACION_012 };
