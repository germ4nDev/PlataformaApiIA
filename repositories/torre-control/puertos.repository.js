/*
    Author: German Valencia
    Pattern: PORTTOS Repository - Maestro de puertos
    Description: Acceso a datos del maestro (ver maestro.repository.js).
*/
const { sequelize } = require('../../database/connection');
const { PuertoModel } = require('../../models/torre-control/puerto.model');
const { RepositorioMaestro } = require('./maestro.repository');

module.exports = new RepositorioMaestro({
  modelo: PuertoModel(sequelize),
  llave: 'id_puerto',
  geometrias: { ubicacion_geo: 'ubicacion_text', geocerca_geo: 'geocerca_text' },
});
