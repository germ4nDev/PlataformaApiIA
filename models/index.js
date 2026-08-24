// // models/index.js
// const { sequelize } = require('../database/connection');
// const { PuertoModel } = require('./torre-control/puerto.model.js');
// const { TerminalModel } = require('./torre-control/terminal.model.js');
// const { MuelleModel } = require('./torre-control/muelle.model');
// const { EventoVialModel } = require('./torre-control/evento-vial.model.js');
// const { BitacoraSincronizacionModel } = require('./torre-control/bitacora-sincronizacion.model.js');

// // 🚨 1. IMPORTA AQUÍ EL MODELO AIS (Verifica que la ruta y el nombre del archivo sean los correctos en tu proyecto)
// const { TCLAisUltimaPosicion } = require('./torre-control/ais-posicion.model.js');

// // Inicializar modelos
// const Puerto = PuertoModel(sequelize);
// const Terminal = TerminalModel(sequelize);
// const Muelle = MuelleModel(sequelize);
// const { TCLAisUltimaPosicionModel } = require('./torre-control/tcl-ais-ultima-posicion.model.js');
// const EventoVial = EventoVialModel(sequelize);
// const BitacoraSincronizacion = BitacoraSincronizacionModel(sequelize);

// // 🚨 2. INICIALIZA EL MODELO AIS
// const TCLAisUltimaPosicion = TCLAisUltimaPosicionModel(sequelize);

// // Definir relaciones (Los alias 'as' son vitales para el Include)
// Puerto.hasMany(Terminal, { foreignKey: 'id_puerto', as: 'terminales' });
// Terminal.belongsTo(Puerto, { foreignKey: 'id_puerto', as: 'puerto' });

// Terminal.hasMany(Muelle, { foreignKey: 'id_terminal', as: 'muelles' });
// Muelle.belongsTo(Terminal, { foreignKey: 'id_terminal', as: 'terminal' });

// // 🚨 3. AÑADE EL MODELO AL EXPORT (Para que el Radar lo pueda encontrar)
// module.exports = {
//   Puerto,
//   Terminal,
//   Muelle,
//   EventoVial,
//   BitacoraSincronizacion,
//   TCLAisUltimaPosicion, // <-- ¡La pieza que faltaba!
//   sequelize
// };

// models/index.js
const { sequelize } = require('../database/connection');
const { PuertoModel } = require('./torre-control/puerto.model.js');
const { TerminalModel } = require('./torre-control/terminal.model.js');
const { MuelleModel } = require('./torre-control/muelle.model');
const { EventoVialModel } = require('./torre-control/evento-vial.model.js');
const { BitacoraSincronizacionModel } = require('./torre-control/bitacora-sincronizacion.model.js');

// 🚨 1. IMPORTAMOS EL MODELO (Una sola vez, en la parte superior)
const { AisUltimaPosicionModel } = require('./torre-control/ais-posicion.model.js');

// Inicializar modelos
const Puerto = PuertoModel(sequelize);
const Terminal = TerminalModel(sequelize);
const Muelle = MuelleModel(sequelize);
const EventoVial = EventoVialModel(sequelize);
const BitacoraSincronizacion = BitacoraSincronizacionModel(sequelize);

// 🚨 2. INICIALIZAMOS EL MODELO AIS (Esta es la única vez que declaramos TCLAisUltimaPosicion)
const TCLAisUltimaPosicion = AisUltimaPosicionModel(sequelize);

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
  sequelize
};