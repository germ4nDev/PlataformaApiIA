/*
    Author: German Valencia
    Pattern: PORTTOS Repository - Históricos de Supertransporte (OT-009)
    Description: Zonas de Supertransporte de los puertos (TCL_MaestroPuertos.zona_supertransporte, migración 024) y
      escritura de TCL_HistoricosSupertransporte con fuente 'SUPERTRANSPORTE' (dato real de datos.gov.co). Solo reemplaza
      las filas de esa fuente para el puerto: lo cargado por Excel (otra fuente) no se toca.
*/
const { QueryTypes } = require('sequelize');
const { db } = require('../../database/connection');
const { esColumnaInexistente } = require('../../helpers/errores.helper');

const COLUMNAS = ['anio', 'mes', 'zona_portuaria', 'tipo_carga', 'total_toneladas', 'fecha_reporte_super', 'fecha_ingesta', 'usuario_cargue',
  'id_puerto', 'fuente', 'simulado'];
const LOTE = 150;   // 11 columnas × 150 = 1.650 parámetros, por debajo del tope de 2.100

/** Puertos activos con su zona de Supertransporte; sin la migración 024, la clave del puerto. */
async function zonasPuertos() {
  const consulta = (conZona) => db.sequelize.query(`
    SELECT id_puerto AS idPuerto, nombre ${conZona ? ', zona_supertransporte AS zona' : ''}
    FROM dbo.TCL_MaestroPuertos WHERE COALESCE(estado, 1) = 1`, { type: QueryTypes.SELECT });
  let filas;
  try { filas = await consulta(true); } catch (error) {
    if (!esColumnaInexistente(error)) throw error;
    filas = await consulta(false);
  }
  return filas.map((f) => ({ idPuerto: String(f.idPuerto), nombre: f.nombre, zona: f.zona || String(f.idPuerto).replace(/_/g, ' ') }));
}

/** Cambia las filas de fuente SUPERTRANSPORTE del puerto por 'filas' (una transacción). */
function reemplazarPuerto(idPuerto, filas, ahoraIso) {
  return db.sequelize.transaction(async (transaction) => {
    await db.sequelize.query(`DELETE FROM dbo.TCL_HistoricosSupertransporte WHERE id_puerto = :idPuerto AND fuente = 'SUPERTRANSPORTE'`,
      { replacements: { idPuerto }, type: QueryTypes.DELETE, transaction });
    for (let i = 0; i < filas.length; i += LOTE) {
      const replacements = {};
      const valores = filas.slice(i, i + LOTE).map((f, j) => '(' + COLUMNAS.map((c) => {
        replacements[c + '_' + j] = c === 'fecha_ingesta' ? ahoraIso.replace('T', ' ').replace('Z', '') : c === 'usuario_cargue' ? 'SYNC_SUPERTRANSPORTE' : f[c];
        return ':' + c + '_' + j;
      }).join(', ') + ')');
      await db.sequelize.query(`INSERT INTO dbo.TCL_HistoricosSupertransporte (${COLUMNAS.join(', ')}) VALUES ${valores.join(',\n')}`,
        { replacements, type: QueryTypes.INSERT, transaction });
    }
    return filas.length;
  });
}

module.exports = { zonasPuertos, reemplazarPuerto };
