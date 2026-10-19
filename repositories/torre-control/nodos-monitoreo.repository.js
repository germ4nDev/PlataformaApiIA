/*
    Author: German Valencia
    Pattern: PORTTOS Repository - Nodos de monitoreo vial
    Description: Acceso a datos de TCL_MaestroNodosMonitoreo.
*/
const { sequelize } = require('../../database/connection');
const { NodoMonitoreoModel } = require('../../models/torre-control/nodo-monitoreo.model');

const Nodo = NodoMonitoreoModel(sequelize);

module.exports = {
  crear: async (datos) => (await Nodo.create(datos)).get({ plain: true }),
  listar: (where = {}) => Nodo.findAll({ raw: true, where }),
  actualizar: async (codigoNodo, datos) => (await Nodo.update(datos, { where: { codigoNodo } }))[0],
};
