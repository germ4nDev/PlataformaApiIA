/*
    Author: German Valencia
    Pattern: PORTTOS Repository - Maestro de terminales
    Description: Acceso a datos del maestro (ver maestro.repository.js).
*/
const { sequelize } = require('../../database/connection');
const { TerminalModel } = require('../../models/torre-control/terminal.model.js');
const { RepositorioMaestro } = require('./maestro.repository');

module.exports = new RepositorioMaestro({
  modelo: TerminalModel(sequelize),
  llave: 'id_terminal',
  geometrias: { geocerca_geo: 'geocerca_text' },
});
