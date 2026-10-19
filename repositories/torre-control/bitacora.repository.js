/*
    Author: German Valencia
    Pattern: PORTTOS Repository - Bitácora de sincronización
    Description: Lecturas de TCL_BitacoraSincronizacion (registro de cada ejecución de los procesos).
*/
const { sequelize } = require('../../database/connection');
const { BitacoraSincronizacionModel } = require('../../models/torre-control/bitacora-sincronizacion.model');

const Bitacora = BitacoraSincronizacionModel(sequelize);

module.exports = {
  ultimas: (limite = 100) => Bitacora.findAll({ raw: true, order: [['fecha_ejecucion', 'DESC']], limit: limite }),
};
