/*
    Author: German Valencia
    Pattern: PORTTOS Repository - Telemetría GNL
    Description: Acceso a datos de TCL_OperacionesFlujoGNL (consolidados del cold path).
*/
const { TCLOperacionesFlujoGNL } = require('../../models');

module.exports = {
  registrarConsolidado: async (datos, { transaction } = {}) => {
    const fila = await TCLOperacionesFlujoGNL.create(datos, { transaction });
    return fila.get ? fila.get({ plain: true }) : fila;
  },
  historial: (id_puerto, limite = 50) => TCLOperacionesFlujoGNL.findAll({
    where: { id_puerto },
    order: [['fecha_inicio_lectura', 'DESC']],
    limit: limite,
    raw: true,
  }),
};
