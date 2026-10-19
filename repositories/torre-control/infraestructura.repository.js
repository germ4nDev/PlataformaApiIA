/*
    Author: German Valencia
    Pattern: PORTTOS Repository - Maestro de infraestructura
    Description: Acceso a datos de TCL_MaestroInfraestructura (ver maestro.repository.js).
      Esta tabla guarda sus geometrías con SRID 0 (así fue creada); no se cambia.
*/
const { sequelize } = require('../../database/connection');
const { InfraestructuraModel } = require('../../models/torre-control/infraestructura.model.js');
const { RepositorioMaestro } = require('./maestro.repository');

module.exports = new RepositorioMaestro({
  modelo: InfraestructuraModel(sequelize),
  llave: 'id_infraestructura',
  geometrias: { ubicacion_geo: 'ubicacion_text', geocerca_geo: 'geocerca_text' },
  srid: 0,
});
