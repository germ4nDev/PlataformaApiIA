/*
    Author: German Valencia
    Pattern: PORTTOS Repository - Catálogo heredado de widgets (TLCCatalogo_Widgets)
    Description: Tabla heredada que aún sirven las rutas /api/widgets de torre-control.
      El tablero actual usa PTLWidgetsMaestro.
*/
const { sequelize } = require('../../database/connection');
const { CatalogoWidgetModel } = require('../../models/torre-control/catalogo-widgets.model');
const { RepositorioMaestro } = require('./maestro.repository');

module.exports = new RepositorioMaestro({ modelo: CatalogoWidgetModel(sequelize), llave: 'codigo_widget' });
