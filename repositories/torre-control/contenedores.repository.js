/*
    Author: German Valencia
    Pattern: PORTTOS Repository - Movimientos de contenedores
    Description: Lecturas de TCL_MovimientosContenedor.
      Con la migración 008: los del puerto + los que no tienen puerto (datos anteriores sin clasificar).
      Sin la migración (columna inexistente): todos, como antes.
*/
const { Op } = require('sequelize');
const { sequelize } = require('../../database/connection');
const { ContenedorMovimientoModel } = require('../../models/torre-control/contenedor-movimiento.model');
const { esColumnaInexistente } = require('../../helpers/errores.helper');

const Movimiento = ContenedorMovimientoModel(sequelize);
const ORDEN = [['fechaCreacion', 'DESC']];

async function movimientosDelPuerto(puerto) {
  try {
    return await Movimiento.findAll({ raw: true, where: { [Op.or]: [{ id_puerto: puerto }, { id_puerto: null }] }, order: ORDEN });
  } catch (error) {
    if (!esColumnaInexistente(error)) throw error;
    return Movimiento.findAll({ raw: true, attributes: { exclude: ['id_puerto'] }, order: ORDEN });
  }
}

module.exports = { movimientosDelPuerto };
