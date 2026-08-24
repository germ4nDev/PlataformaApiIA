/*
    Author: German Valencia
    Service: Lógica de Negocio para Nodos de Monitoreo
*/
const { NodoMonitoreoModel } = require('../../models/torre-control/nodo-monitoreo.model');

const NodoMonitoreoService = {

  crearNodo: async (dtoData, sequelizeInstance) => {
    return await NodoMonitoreoModel(sequelizeInstance).create(dtoData);
  },

  obtenerNodosActivos: async (sequelizeInstance) => {
    return await NodoMonitoreoModel(sequelizeInstance).findAll({
      where: { estado: 'ACTIVO' }
    });
  },

  obtenerTodosLosNodos: async (sequelizeInstance) => {
    return await NodoMonitoreoModel(sequelizeInstance).findAll();
  },

  actualizarNodo: async (codigoNodo, updateData, userContext, sequelizeInstance) => {
    const model = NodoMonitoreoModel(sequelizeInstance);

    const dataAuditoria = {
      ...updateData,
      codigoUsuarioModificacion: userContext.codigoUsuario,
      fechaModificacion: new Date()
    };

    const [rowsUpdated] = await model.update(dataAuditoria, {
      where: { codigoNodo: codigoNodo }
    });

    return rowsUpdated > 0;
  }
};

module.exports = NodoMonitoreoService;