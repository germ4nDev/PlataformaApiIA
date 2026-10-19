/*
    Author: German Valencia
    Pattern: PORTTOS Repository - Line-up marítimo (ORM)
    Description: Lecturas y cargas de TCL_LineUpMaritimo con el modelo Sequelize.
      Las consultas analíticas del line-up (tarjetas de terminal, ETA vs ATA) están en maritimo.repository.js.
*/
const { Op } = require('sequelize');
const { sequelize } = require('../../database/connection');
const { LineUpMaritimoModel } = require('../../models/torre-control/line-up-maritimo.model');

const LineUp = LineUpMaritimoModel(sequelize);

/** Registros activos ordenados por ETA; opcionalmente de un puerto. */
const listarActivos = (puerto = null) => LineUp.findAll({
  raw: true,
  where: { estadoRegistro: true, ...(puerto ? { puerto } : {}) },
  order: [['eta', 'ASC']],
});

/** Inactiva los registros activos de las terminales indicadas (antes de cargar el line-up nuevo). */
const inactivarTerminales = (terminales, codigoUsuario, { transaction } = {}) => LineUp.update(
  { estadoRegistro: false, codigoUsuarioModificacion: codigoUsuario, fechaModificacion: new Date().toISOString() },
  { where: { terminal: { [Op.in]: terminales }, estadoRegistro: true }, transaction },
);

const crearVarios = async (filas, { transaction } = {}) =>
  (await LineUp.bulkCreate(filas, { transaction })).map((f) => f.get({ plain: true }));

module.exports = { listarActivos, inactivarTerminales, crearVarios };
