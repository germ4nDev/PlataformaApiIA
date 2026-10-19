/*
    Author: German Valencia
    Pattern: PORTTOS Repository - Inventario de contenedores en patio
    Description: Acceso a datos de TCL_InventarioContenedores (ver maestro.repository.js).
*/
const { sequelize } = require('../../database/connection');
const { InventarioContenedoresModel } = require('../../models/torre-control/inventario-contenedores.model');
const { RepositorioMaestro } = require('./maestro.repository');

module.exports = new RepositorioMaestro({ modelo: InventarioContenedoresModel(sequelize), llave: 'id_inventario' });
