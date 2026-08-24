/*
    Author: German Valencia
    Pattern: QPLUS Job Scheduler - Disparador RNDC
*/
const cron = require('node-cron');
const RndcBatchService = require('../services/torre-control/rndc-batch.service');

const inicializarJobsRNDC = () => {
  console.log('🔄 Iniciando calculo de ley little ...');
  cron.schedule('0 2 * * *', async () => {
    // console.log('[CRON] Despertando proceso batch RNDC...');
    try {
      // El Job simplemente llama al Servicio, tal como lo haría un Controlador
      await RndcBatchService.ejecutarCalculoLeyLittle();
      // console.log('[CRON] Proceso nocturno finalizado con éxito.');
    } catch (error) {
      // console.error('[CRON] El proceso nocturno falló y fue atrapado por el scheduler.');
    }
  });
};

module.exports = { inicializarJobsRNDC };