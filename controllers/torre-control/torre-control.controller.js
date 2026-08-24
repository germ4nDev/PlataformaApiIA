const db = require('../../models');
console.log('📌 Modelos disponibles en Sequelize:', Object.keys(db));
const { response } = require('express');
const torreControlService = require('../../services/torre-control/torre-control.service');

const ejecutarConMonitoreo = require('../../utils/monitorETL');
const SincronizacionService = require('../../jobs/sincronizacion.service');

const obtenerEstadoTuneles = async (req, res) => {
  try {
    const registros = await torreControlService.getBitacora()

    res.status(200).json({
      ok: true,
      data: registros
    });

  } catch (error) {
    console.error('❌ Error obteniendo el estado de los túneles:', error);
    res.status(500).json({
      ok: false,
      msg: 'Error interno del servidor al consultar la bitácora',
      error: error.message
    });
  }
};

const obtenerBitacora = async (req, res) => {
  try {
    const logs = await torreControlService.getBitacora();
    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    console.error('Error al consultar bitácora:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

const ejecutarSincronizacionManual = async (req, res) => {
  try {
    await ejecutarConMonitoreo('Sync_Manual_DryRun', async () => {
      await SincronizacionService.ejecutarSincronizacion({ dryRun: true });
    });

    res.status(200).json({
      ok: true,
      msg: '🚀 Ejecución manual (dryRun) finalizada. Revisa la bitácora.'
    });

  } catch (error) {
    console.error('❌ Error en ejecución manual:', error);
    res.status(500).json({
      ok: false,
      msg: 'Error ejecutando la sincronización manual',
      error: error.message
    });
  }
};

module.exports = {
  obtenerEstadoTuneles,
  obtenerBitacora,
  ejecutarSincronizacionManual
};