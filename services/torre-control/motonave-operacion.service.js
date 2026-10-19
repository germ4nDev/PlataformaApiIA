/*
    Author: German Valencia
    Pattern: PORTTOS Service - Operaciones de motonaves
    Description: Operaciones registradas por terminal y vinculación manual aviso ↔ MMSI.
      Acceso a datos en motonaves-operacion.repository.js.
      (Corregido 2026-10-18: antes usaba db.TCLMotonavesOperacion y db.TCLHomologacionMmsi, que no existen
       en la conexión, y ambos endpoints fallaban.)
*/
const { HomologacionMmsiDTO } = require('../../models/torre-control/homologador-mmsi.model');
const repositorio = require('../../repositories/torre-control/motonaves-operacion.repository');

class MotonaveOperacionService {
  async obtenerOperacionesActivas(codigoTerminal = null) {
    return repositorio.listar(codigoTerminal);
  }

  async registrarOperacion(dto) {
    return repositorio.crear(dto);
  }

  async vincularMotonaveManual(rawData) {
    const [registro, creado] = await repositorio.vincularMmsi(HomologacionMmsiDTO(rawData));
    return { registro, creado, mensaje: creado ? 'Vinculación creada con éxito' : 'Vinculación actualizada con éxito' };
  }
}

module.exports = new MotonaveOperacionService();
