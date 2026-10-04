// // models/index.js
// const { sequelize } = require('../database/connection');

// // ==========================================
// // 1. IMPORTAMOS LOS MODELOS
// // ==========================================
// // --- Módulo Torre de Control ---
// const { PuertoModel } = require('./torre-control/puerto.model.js');
// const { TerminalModel } = require('./torre-control/terminal.model.js');
// const { MuelleModel } = require('./torre-control/muelle.model');
// const { EventoVialModel } = require('./torre-control/evento-vial.model.js');
// const { BitacoraSincronizacionModel } = require('./torre-control/bitacora-sincronizacion.model.js');
// const { AisUltimaPosicionModel } = require('./torre-control/ais-posicion.model.js');

// // --- Módulo Layouts Antiguo / Base ---
// const { LayoutModel } = require('./layout.js');
// const { UsuarioWidgetModel } = require('./usuario-widget.model.js');

// // --- NUEVO: Motor Layouts Metadata-Driven QPLUS ---
// const { TipoPestanaModel } = require('./tipo-pestana.model .js'); // Importado correctamente
// const { LayoutPestanaModel } = require('./layout-pestana.model.js');
// const { CfgZonasDinamicaModel } = require('./cfg-zonas-dinamicas.model.js');
// const { WidgetMaestroModel } = require('./widget.js');

// const { InfraestructuraTanquesModel } = require('./torre-control/infraestructura-tanques.model');
// const { OperacionesFlujoGNLModel } = require('./torre-control/operaciones-flujo-gnl.model');
// const { NominacionesGasModel } = require('./torre-control/nominaciones-gas.model');


// // ==========================================
// // 2. INICIALIZAMOS LOS MODELOS
// // ==========================================
// // --- Torre de Control ---
// const Puerto = PuertoModel(sequelize);
// const Terminal = TerminalModel(sequelize);
// const Muelle = MuelleModel(sequelize);
// const EventoVial = EventoVialModel(sequelize);
// const BitacoraSincronizacion = BitacoraSincronizacionModel(sequelize);
// const TCLAisUltimaPosicion = AisUltimaPosicionModel(sequelize);

// // --- Layouts ---
// const PTLLayouts = LayoutModel(sequelize);
// const PTLUsuarioWidgets = UsuarioWidgetModel(sequelize);

// // 🚨 CORREGIDO: Le cambiamos el nombre a la constante por "TiposPestana"
// const TiposPestana = TipoPestanaModel(sequelize);
// const LayoutPestana = LayoutPestanaModel(sequelize);
// const CfgZonasDinamicas = CfgZonasDinamicaModel(sequelize);
// const WidgetsMaestro = WidgetMaestroModel(sequelize);




// // ==========================================
// // 3. DEFINIMOS LAS RELACIONES
// // ==========================================
// // --- Relaciones Torre de Control ---
// Puerto.hasMany(Terminal, { foreignKey: 'id_puerto', as: 'terminales' });
// Terminal.belongsTo(Puerto, { foreignKey: 'id_puerto', as: 'puerto' });

// Terminal.hasMany(Muelle, { foreignKey: 'id_terminal', as: 'muelles' });
// Muelle.belongsTo(Terminal, { foreignKey: 'id_terminal', as: 'terminal' });

// // --- Relaciones Motor Metadata-Driven QPLUS ---
// // A. TIPO DE PESTAÑA <-> PESTAÑA (1 a Muchos)
// TiposPestana.hasMany(LayoutPestana, { foreignKey: 'codigoTipo', sourceKey: 'codigoTipo', as: 'pestanasVinculadas' });
// LayoutPestana.belongsTo(TiposPestana, { foreignKey: 'codigoTipo', targetKey: 'codigoTipo', as: 'estrategiaTipo' });

// // B. PESTAÑA <-> ZONA DINÁMICA (1 a 1)
// LayoutPestana.hasOne(CfgZonasDinamicas, { foreignKey: 'codigoPestana', sourceKey: 'codigoPestana', as: 'zonaDinamica' });
// CfgZonasDinamicas.belongsTo(LayoutPestana, { foreignKey: 'codigoPestana', targetKey: 'codigoPestana', as: 'pestanaPadre' });

// // C. PESTAÑA <-> WIDGETS MAESTROS (1 a Muchos)
// LayoutPestana.hasMany(WidgetsMaestro, { foreignKey: 'codigoPestana', sourceKey: 'codigoPestana', as: 'widgetsMaestros' });
// WidgetsMaestro.belongsTo(LayoutPestana, { foreignKey: 'codigoPestana', targetKey: 'codigoPestana', as: 'pestanaPadre' });


// // ==========================================
// // 4. EXPORTAMOS
// // ==========================================
// module.exports = {
//   sequelize,
//   // Torre de Control
//   Puerto,
//   Terminal,
//   Muelle,
//   EventoVial,
//   BitacoraSincronizacion,
//   TCLAisUltimaPosicion,
//   // Layouts
//   PTLLayouts,
//   PTLUsuarioWidgets,
//   TiposPestana,
//   LayoutPestana,
//   CfgZonasDinamicas,
//   WidgetsMaestro
// };

// models/index.js
const { sequelize } = require('../database/connection');

// ==========================================
// 1. IMPORTAMOS LOS MODELOS
// ==========================================
// --- Módulo Torre de Control ---
const { PuertoModel } = require('./torre-control/puerto.model.js');
const { TerminalModel } = require('./torre-control/terminal.model.js');
const { MuelleModel } = require('./torre-control/muelle.model');
const { EventoVialModel } = require('./torre-control/evento-vial.model.js');
const { BitacoraSincronizacionModel } = require('./torre-control/bitacora-sincronizacion.model.js');
const { AisUltimaPosicionModel } = require('./torre-control/ais-posicion.model.js');

// --- Módulo Layouts Antiguo / Base ---
const { LayoutModel } = require('./layout.js');
const { UsuarioWidgetModel } = require('./usuario-widget.model.js');

// --- Motor Layouts Metadata-Driven QPLUS ---
const { TipoPestanaModel } = require('./tipo-pestana.model .js');
const { LayoutPestanaModel } = require('./layout-pestana.model.js');
const { CfgZonasDinamicaModel } = require('./cfg-zonas-dinamicas.model.js');
const { WidgetMaestroModel } = require('./widget.js');

// --- Módulo GNL (Líquidos y Gases) ---
const { InfraestructuraTanquesModel } = require('./torre-control/infraestructura-tanques.model');
const { OperacionesFlujoGNLModel } = require('./torre-control/operaciones-flujo-gnl.model');
const { NominacionesGasModel } = require('./torre-control/nominaciones-gas.model');

// ==========================================
// 2. INICIALIZAMOS LOS MODELOS
// ==========================================
// --- Torre de Control ---
const Puerto = PuertoModel(sequelize);
const Terminal = TerminalModel(sequelize);
const Muelle = MuelleModel(sequelize);
const EventoVial = EventoVialModel(sequelize);
const BitacoraSincronizacion = BitacoraSincronizacionModel(sequelize);
const TCLAisUltimaPosicion = AisUltimaPosicionModel(sequelize);

// --- Layouts ---
const PTLLayouts = LayoutModel(sequelize);
const PTLUsuarioWidgets = UsuarioWidgetModel(sequelize);
const TiposPestana = TipoPestanaModel(sequelize);
const LayoutPestana = LayoutPestanaModel(sequelize);
const CfgZonasDinamicas = CfgZonasDinamicaModel(sequelize);
const WidgetsMaestro = WidgetMaestroModel(sequelize);

// --- Módulo GNL ---
const PTLInfraestructuraTanques = InfraestructuraTanquesModel(sequelize);
const TCLOperacionesFlujoGNL = OperacionesFlujoGNLModel(sequelize);
const PTLNominacionesGas = NominacionesGasModel(sequelize);

// ==========================================
// 3. DEFINIMOS LAS RELACIONES
// ==========================================
// --- Relaciones Torre de Control ---
Puerto.hasMany(Terminal, { foreignKey: 'id_puerto', as: 'terminales' });
Terminal.belongsTo(Puerto, { foreignKey: 'id_puerto', as: 'puerto' });

Terminal.hasMany(Muelle, { foreignKey: 'id_terminal', as: 'muelles' });
Muelle.belongsTo(Terminal, { foreignKey: 'id_terminal', as: 'terminal' });

// --- Relaciones Motor Metadata-Driven QPLUS ---
// A. TIPO DE PESTAÑA <-> PESTAÑA (1 a Muchos)
TiposPestana.hasMany(LayoutPestana, { foreignKey: 'codigoTipo', sourceKey: 'codigoTipo', as: 'pestanasVinculadas' });
LayoutPestana.belongsTo(TiposPestana, { foreignKey: 'codigoTipo', targetKey: 'codigoTipo', as: 'estrategiaTipo' });

// B. PESTAÑA <-> ZONA DINÁMICA (1 a 1)
LayoutPestana.hasOne(CfgZonasDinamicas, { foreignKey: 'codigoPestana', sourceKey: 'codigoPestana', as: 'zonaDinamica' });
CfgZonasDinamicas.belongsTo(LayoutPestana, { foreignKey: 'codigoPestana', targetKey: 'codigoPestana', as: 'pestanaPadre' });

// C. PESTAÑA <-> WIDGETS MAESTROS (1 a Muchos)
LayoutPestana.hasMany(WidgetsMaestro, { foreignKey: 'codigoPestana', sourceKey: 'codigoPestana', as: 'widgetsMaestros' });
WidgetsMaestro.belongsTo(LayoutPestana, { foreignKey: 'codigoPestana', targetKey: 'codigoPestana', as: 'pestanaPadre' });

// --- Relaciones Módulo GNL ---
// Vincular infraestructura, operaciones y nominaciones al maestro de Puertos
Puerto.hasMany(PTLInfraestructuraTanques, { foreignKey: 'id_puerto', as: 'tanquesGNL' });
PTLInfraestructuraTanques.belongsTo(Puerto, { foreignKey: 'id_puerto', as: 'puerto' });

Puerto.hasMany(TCLOperacionesFlujoGNL, { foreignKey: 'id_puerto', as: 'flujosGNL' });
TCLOperacionesFlujoGNL.belongsTo(Puerto, { foreignKey: 'id_puerto', as: 'puerto' });

Puerto.hasMany(PTLNominacionesGas, { foreignKey: 'id_puerto', as: 'nominacionesGNL' });
PTLNominacionesGas.belongsTo(Puerto, { foreignKey: 'id_puerto', as: 'puerto' });

// ==========================================
// 4. EXPORTAMOS
// ==========================================
module.exports = {
  sequelize,

  // Torre de Control
  Puerto,
  Terminal,
  Muelle,
  EventoVial,
  BitacoraSincronizacion,
  TCLAisUltimaPosicion,

  // Layouts
  PTLLayouts,
  PTLUsuarioWidgets,
  TiposPestana,
  LayoutPestana,
  CfgZonasDinamicas,
  WidgetsMaestro,

  // Módulo GNL
  PTLInfraestructuraTanques,
  TCLOperacionesFlujoGNL,
  PTLNominacionesGas
};