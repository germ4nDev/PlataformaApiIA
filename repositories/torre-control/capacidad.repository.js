/*
    Author: German Valencia
    Pattern: PORTTOS Repository - Capacidad de nodos operativos (migración 013)
    Description: Catálogo TCL_CapacidadNodos, fotos TCL_OcupacionNodos y lectura de las bodegas del puerto
      (TCL_MaestroBodegas sigue siendo el dueño de las bodegas; aquí solo se leen).
      Sin la migración 013 lanza migracionPendiente (503).
*/
const { QueryTypes } = require('sequelize');
const { db } = require('../../database/connection');
const { esColumnaInexistente, esTablaInexistente, migracionPendiente } = require('../../helpers/errores.helper');

const MIGRACION_013 = '013_granel_suelta_capacidad_noticias.sql';

async function q(sql, replacements = {}, type = QueryTypes.SELECT) {
  try {
    return await db.sequelize.query(sql, { replacements, type });
  } catch (error) {
    if (esTablaInexistente(error) || esColumnaInexistente(error) || /Invalid object name/i.test(error?.message || '')) {
      throw migracionPendiente(MIGRACION_013);
    }
    throw error;
  }
}

const nodos = (idPuerto, categoria = null) => q(`
  SELECT id_nodo, nombre, categoria, operador, unidad_capacidad, CAST(capacidad AS FLOAT) AS capacidad, descripcion_capacidad,
         operaciones, id_terminal, id_infraestructura, CAST(activo AS INT) AS activo, fuente
  FROM dbo.TCL_CapacidadNodos WITH (NOLOCK)
  WHERE id_puerto = :idPuerto AND activo = 1 ${categoria ? 'AND categoria = :categoria' : ''}
  ORDER BY categoria, nombre`, { idPuerto, categoria });

/**
 * Bodegas activas del puerto. TCL_MaestroBodegas guarda el puerto por nombre ('BUENAVENTURA', 'SANTA MARTA'),
 * igual que bodegas.repository.js; se acepta también el id del maestro de puertos.
 */
const bodegas = (idPuerto, clave) => q(`
  SELECT id_bodega, codigo_bodega, nombre_bodega, tipo_almacenamiento, tipo_carga_principal,
         CAST(capacidad_maxima_ton AS FLOAT) AS capacidad_maxima_ton, CAST(inventario_actual_ton AS FLOAT) AS inventario_actual_ton,
         estado_operativo, CAST(activo AS INT) AS activo
  FROM dbo.TCL_MaestroBodegas WITH (NOLOCK)
  WHERE activo = 1 AND UPPER(LTRIM(RTRIM(id_puerto))) IN (UPPER(:idPuerto), :clave, REPLACE(:clave, '_', ' '))`,
{ idPuerto, clave: String(clave || idPuerto).toUpperCase() });

/** Fotos de ocupación del puerto desde la fecha ISO dada. */
const ocupaciones = (idPuerto, desde) => q(`
  SELECT id_nodo, fecha, CAST(ocupacion AS FLOAT) AS ocupacion, CAST(ocupacion_pct AS FLOAT) AS ocupacion_pct,
         ingresos_h, salidas_h, espera_min, fuente, CAST(simulado AS INT) AS simulado
  FROM dbo.TCL_OcupacionNodos WITH (NOLOCK)
  WHERE id_puerto = :idPuerto AND fecha >= :desde`, { idPuerto, desde });

/** Inserta fotos de ocupación (lotes de 150 × 10 parámetros). */
async function guardarOcupaciones(filas) {
  for (let i = 0; i < filas.length; i += 150) {
    const lote = filas.slice(i, i + 150);
    const r = {};
    const valores = lote.map((f, j) => {
      Object.assign(r, {
        [`pu${j}`]: f.id_puerto, [`no${j}`]: f.id_nodo, [`fe${j}`]: f.fecha, [`oc${j}`]: f.ocupacion ?? null,
        [`pc${j}`]: f.ocupacion_pct, [`in${j}`]: f.ingresos_h ?? null, [`sa${j}`]: f.salidas_h ?? null,
        [`es${j}`]: f.espera_min ?? null, [`fu${j}`]: f.fuente, [`si${j}`]: f.simulado ? 1 : 0,
      });
      return `(:pu${j}, :no${j}, :fe${j}, :oc${j}, :pc${j}, :in${j}, :sa${j}, :es${j}, :fu${j}, :si${j})`;
    });
    await q(`INSERT INTO dbo.TCL_OcupacionNodos (id_puerto, id_nodo, fecha, ocupacion, ocupacion_pct, ingresos_h, salidas_h, espera_min, fuente, simulado)
             VALUES ${valores.join(', ')}`, r, QueryTypes.INSERT);
  }
  return filas.length;
}

/** Alta o cambio de un nodo del catálogo (ingesta o administración). */
async function guardarNodo(n, ahora) {
  await q(`
    MERGE dbo.TCL_CapacidadNodos AS d
    USING (SELECT :id_puerto AS id_puerto, :id_nodo AS id_nodo) AS s ON d.id_puerto = s.id_puerto AND d.id_nodo = s.id_nodo
    WHEN MATCHED THEN UPDATE SET nombre = :nombre, categoria = :categoria, operador = :operador, unidad_capacidad = :unidad_capacidad,
      capacidad = :capacidad, descripcion_capacidad = :descripcion_capacidad, operaciones = :operaciones, id_terminal = :id_terminal,
      activo = :activo, fuente = :fuente, fechaModificacion = :ahora
    WHEN NOT MATCHED THEN INSERT (id_puerto, id_nodo, nombre, categoria, operador, unidad_capacidad, capacidad, descripcion_capacidad,
      operaciones, id_terminal, activo, fuente, fechaModificacion)
      VALUES (:id_puerto, :id_nodo, :nombre, :categoria, :operador, :unidad_capacidad, :capacidad, :descripcion_capacidad,
      :operaciones, :id_terminal, :activo, :fuente, :ahora);`, {
    operador: null, descripcion_capacidad: null, operaciones: null, id_terminal: null, ...n, activo: n.activo === false ? 0 : 1, ahora,
  }, QueryTypes.UPSERT);
}

/** ¿Hubo fotos reales (no simuladas) del puerto desde la fecha dada? */
async function hayDatosReales(idPuerto, desde) {
  const [f] = await q(`SELECT COUNT(*) AS n FROM dbo.TCL_OcupacionNodos WITH (NOLOCK)
                       WHERE id_puerto = :idPuerto AND simulado = 0 AND fecha >= :desde`, { idPuerto, desde });
  return Number(f?.n) > 0;
}

const purgar = (antes) => q('DELETE FROM dbo.TCL_OcupacionNodos WHERE fecha < :antes', { antes }, QueryTypes.DELETE);

module.exports = { MIGRACION_013, nodos, bodegas, ocupaciones, guardarOcupaciones, guardarNodo, hayDatosReales, purgar };
