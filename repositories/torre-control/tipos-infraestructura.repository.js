/*
    Author: German Valencia
    Pattern: PORTTOS Repository - Maestro de tipos-infraestructura
    Description: Acceso a datos del maestro (ver maestro.repository.js).
*/
const { sequelize } = require('../../database/connection');
const { TipoInfraestructuraModel } = require('../../models/torre-control/tipo-infraestructura.model');
const { RepositorioMaestro } = require('./maestro.repository');

module.exports = new RepositorioMaestro({
  modelo: TipoInfraestructuraModel(sequelize),
  llave: 'id_tipo',
  geometrias: {},
});
