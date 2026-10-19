/*
    Author: German Valencia
    Pattern: PORTTOS Service - Nodos de monitoreo vial
    Description: Puntos de la red vial donde se consulta el clima. Acceso a datos en nodos-monitoreo.repository.js.
      (El parámetro sequelizeInstance de versiones anteriores ya no se usa; se acepta por compatibilidad.)
*/
const repositorio = require('../../repositories/torre-control/nodos-monitoreo.repository');

const NodoMonitoreoService = {
  crearNodo: (dto) => repositorio.crear(dto),
  obtenerNodosActivos: () => repositorio.listar({ estado: 'ACTIVO' }),
  obtenerTodosLosNodos: () => repositorio.listar(),
  actualizarNodo: async (codigoNodo, cambios, userContext) => {
    const filas = await repositorio.actualizar(codigoNodo, {
      ...cambios,
      codigoUsuarioModificacion: userContext.codigoUsuario,
      fechaModificacion: new Date(),
    });
    return filas > 0;
  },
};

module.exports = NodoMonitoreoService;
