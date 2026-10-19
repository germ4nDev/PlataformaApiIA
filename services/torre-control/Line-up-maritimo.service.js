/*
    Author: German Valencia
    Pattern: PORTTOS Service - Line-up marítimo
    Description: Consulta del line-up activo y carga masiva por terminal: al cargar el line-up de una terminal,
      sus registros activos anteriores se inactivan en la misma transacción. Acceso a datos en lineup.repository.js.
*/
const LineUpRepository = require('../../repositories/torre-control/lineup.repository');
const { conTransaccion } = require('../../helpers/transaccion.helper');

class TLCLineUpMaritimoService {
  async obtenerLineUp(puerto = null) {
    return LineUpRepository.listarActivos(puerto);
  }

  async registrarIngestaMasiva(registros, usuarioModificacion) {
    return conTransaccion(async (transaction) => {
      const terminales = [...new Set(registros.map((r) => r.terminal))];
      if (terminales.length) await LineUpRepository.inactivarTerminales(terminales, usuarioModificacion, { transaction });
      return LineUpRepository.crearVarios(registros, { transaction });
    });
  }
}

module.exports = new TLCLineUpMaritimoService();
