/*
    Author: German Valencia
    Pattern: PORTTOS Service - Homologación aviso DIMAR → MMSI
    Description: Para cada aviso sin MMSI busca el MMSI de referencia de su número OMI y lo vincula.
      Así el motor AIS puede rastrear las naves avisadas. Lo programa jobs/cron.manager.js ('homologacion-mmsi').
*/
const MaritimoRepository = require('../../repositories/torre-control/maritimo.repository');

async function homologarPendientes() {
  const pendientes = await MaritimoRepository.getNavesSinHomologar();
  let homologadas = 0;
  for (const nave of pendientes) {
    const mmsi = await MaritimoRepository.getMmsiPorOmi(nave.omi);
    if (mmsi) {
      await MaritimoRepository.registrarHomologacion(nave.id_aviso, mmsi);
      homologadas++;
    }
  }
  return { insertados: homologadas };
}

module.exports = { homologarPendientes };
