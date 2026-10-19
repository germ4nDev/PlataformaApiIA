/*
    Author: German Valencia
    Pattern: PORTTOS Repository - Maestro de faros (geocercas de control)
    Description: Acceso a datos de TCL_MaestroFaros (ver maestro.repository.js).
*/
const { sequelize } = require('../../database/connection');
const { FaroModel } = require('../../models/torre-control/faro.model');
const { RepositorioMaestro } = require('./maestro.repository');

module.exports = new RepositorioMaestro({
  modelo: FaroModel(sequelize),
  llave: 'id_faro',
  geometrias: { geocerca_geo: 'geocerca_text' },
});
