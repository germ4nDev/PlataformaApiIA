/*
    Author: German Valencia
    Pattern: PORTTOS Repository - Maestro de muelles
    Description: Acceso a datos del maestro (ver maestro.repository.js).
*/
const { sequelize } = require('../../database/connection');
const { MuelleModel } = require('../../models/torre-control/muelle.model.js');
const { RepositorioMaestro } = require('./maestro.repository');

module.exports = new RepositorioMaestro({
  modelo: MuelleModel(sequelize),
  llave: 'id_interno',
  geometrias: { geocerca_geo: 'geocerca_text' },
});
