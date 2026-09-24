/*
    Author: German Valencia
    Pattern: PORTTOS Service - Matriz
*/
const { sequelize } = require('../../database/connection');
const { MatrizOperacionModel } = require('../../models/torre-control/tlc-matriz-operaciones.model');

const TLCMatrizOperaciones = MatrizOperacionModel(sequelize);

class TLCMatrizOperacionesService {

  async obtenerMatriz(terminalFilter = null) {
    const queryOptions = {};

    // Filtramos por terminal si el dashboard lo solicita
    if (terminalFilter) {
      queryOptions.where = { terminal: terminalFilter };
    }

    return await TLCMatrizOperaciones.findAll(queryOptions);
  }
}

module.exports = new TLCMatrizOperacionesService();