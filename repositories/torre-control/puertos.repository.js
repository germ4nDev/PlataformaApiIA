/*
    Author: German Valencia
    Pattern: QPLUS Repository Pattern - Maestro de Puertos
*/
const { QueryTypes } = require('sequelize');
const { db } = require('../../database/connection');

const PuertoRepository = {
  async obtenerPuertosActivos() {
    const sql = `SELECT puertoKey FROM T_Maestro_Puertos WHERE estado = 1`;
    return await db.sequelize.query(sql, {
      type: db.sequelize.QueryTypes.SELECT
    });
  }
};

module.exports = PuertoRepository;