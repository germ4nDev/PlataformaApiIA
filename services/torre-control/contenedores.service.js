/*
    Author: German Valencia
    Pattern: PORTTOS Service - Contenedores
    Description: Orquesta las lecturas de la pestaña Contenedores y entrega el tablero del núcleo puro
      utils/contenedores.js (Fase 1 de la vista ampliada, 2026-10-23): inventario real en patio
      (TCL_InventarioContenedores), patios del catálogo de capacidad con su ocupación y movimientos. Se retiran los
      valores fijos de AD-04, Math.random() y los multiplicadores; lo que no tiene fuente queda vacío y explicado.
      Cada lectura opcional falla por separado (tabla o migración ausente → lista vacía) sin tumbar el tablero.
*/
const { Op } = require('sequelize');
const ContenedoresRepository = require('../../repositories/torre-control/contenedores.repository');
const CapacidadRepository = require('../../repositories/torre-control/capacidad.repository');
const { contextoPuerto } = require('../../helpers/puerto-contexto.helper');
const { esTablaInexistente } = require('../../helpers/errores.helper');
const { armarContenedores } = require('../../utils/contenedores');

/** Lectura opcional: si la tabla o su migración no existe todavía devuelve []; cualquier otro error se propaga. */
const opcional = (promesa) => promesa.catch((error) => {
  if (esTablaInexistente(error) || error?.codigo === 'MIGRACION_PENDIENTE') return [];
  throw error;
});

const obtenerDatosContenedores = async (puerto = 'BUENAVENTURA', ahora = new Date()) => {
  const clave = String(puerto || 'BUENAVENTURA').trim().toUpperCase();
  const ctx = await contextoPuerto(clave).catch(() => ({ clave, idPuerto: clave, nombre: clave }));
  const idsPuerto = [...new Set([ctx.clave, ctx.idPuerto, String(ctx.nombre || '').toUpperCase(), clave.replace(/_/g, ' ')].filter(Boolean))];
  const desdeFotos = new Date(ahora.getTime() - 6 * 3600000).toISOString();

  // require diferido: el repositorio de inventario carga su modelo Sequelize al importarse
  const InventarioContenedoresRepository = require('../../repositories/torre-control/inventario-contenedores.repository');
  try {
    const [movimientos, inventario, nodos, fotos] = await Promise.all([
      ContenedoresRepository.movimientosDelPuerto(clave),
      opcional(InventarioContenedoresRepository.listar({ where: { id_puerto: { [Op.in]: idsPuerto } } })),
      opcional(CapacidadRepository.nodos(ctx.idPuerto)),
      opcional(CapacidadRepository.ocupaciones(ctx.idPuerto, desdeFotos)),
    ]);
    return armarContenedores({ movimientos, inventario, nodos, fotos, puerto: clave }, ahora);
  } catch (error) {
    // Se propaga el error original (conserva el número de error SQL para responderError)
    console.error('❌ [ContenedoresService] Error al armar el tablero de contenedores:', error.message);
    throw error;
  }
};

module.exports = { obtenerDatosContenedores };
