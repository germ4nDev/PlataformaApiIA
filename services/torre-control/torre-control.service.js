/*
    Author: German Valencia
    Pattern: PORTTOS Service - Torre de control (procesos)
    Description: Estado de los procesos de fondo (bitácora de sincronización). Acceso a datos en bitacora.repository.js.
*/
const BitacoraRepository = require('../../repositories/torre-control/bitacora.repository');

class TorreControlService {
  async getBitacora() {
    return { success: true, statusCode: 200, data: await BitacoraRepository.ultimas(100) };
  }
}

module.exports = new TorreControlService();
