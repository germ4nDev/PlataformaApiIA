/*
    Author: German Valencia
    Pattern: PORTTOS Helper - Transacciones
    Description: Los servicios abren transacciones sin importar la conexión ni escribir SQL.
      conTransaccion(async (t) => { await repo.crear(dto, { transaction: t }); ... })
      Si la función lanza, la transacción se revierte y el error sigue su curso.
*/
const { sequelize } = require('../database/connection');

const conTransaccion = (fn) => sequelize.transaction(fn);

module.exports = { conTransaccion };
