// models/index.js
const { sequelize } = require('../database/connection');
const { PuertoModel } = require('./torre-control/puerto.model.js');
const { TerminalModel } = require('./torre-control/terminal.model.js');
const { MuelleModel } = require('./torre-control/muelle.model');
const { EventoVialModel } = require('./torre-control/evento-vial.model.js');
const { BitacoraSincronizacionModel } = require('./torre-control/bitacora-sincronizacion.model.js');

// 🚨 1. IMPORTAMOS EL MODELO (Una sola vez, en la parte superior)
const { AisUltimaPosicionModel } = require('./torre-control/ais-posicion.model.js');
const { UsuarioWidgetModel } = require('./usuario-widget.model.js');

// Inicializar modelos
const Puerto = PuertoModel(sequelize);
const Terminal = TerminalModel(sequelize);
const Muelle = MuelleModel(sequelize);
const EventoVial = EventoVialModel(sequelize);
const BitacoraSincronizacion = BitacoraSincronizacionModel(sequelize);
const { LayoutModel } = require('./layout.js');
// 🚨 2. INICIALIZAMOS EL MODELO AIS (Esta es la única vez que declaramos TCLAisUltimaPosicion)
const TCLAisUltimaPosicion = AisUltimaPosicionModel(sequelize);
const PTLLayouts = LayoutModel(sequelize);
const PTLUsuarioWidgets = UsuarioWidgetModel(sequelize);

// Definir relaciones (Los alias 'as' son vitales para el Include)
Puerto.hasMany(Terminal, { foreignKey: 'id_puerto', as: 'terminales' });
Terminal.belongsTo(Puerto, { foreignKey: 'id_puerto', as: 'puerto' });

Terminal.hasMany(Muelle, { foreignKey: 'id_terminal', as: 'muelles' });
Muelle.belongsTo(Terminal, { foreignKey: 'id_terminal', as: 'terminal' });

// 🚨 3. EXPORTAMOS
module.exports = {
  Puerto,
  Terminal,
  Muelle,
  EventoVial,
  BitacoraSincronizacion,
  TCLAisUltimaPosicion,
  PTLLayouts,
  PTLUsuarioWidgets,
  sequelize
};