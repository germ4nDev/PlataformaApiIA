const { response } = require('express');
const torreControlService = require('../../services/torre-control/torre-control.service');

const ejecutarConMonitoreo = require('../../utils/monitorETL');
const SincronizacionService = require('../../services/torre-control/sincronizacion.service');

const { responderError } = require('../../helpers/errores.helper');
const obtenerEstadoTuneles = async (req, res) => {
  try {
    const registros = await torreControlService.getBitacora()

    res.status(200).json({
      ok: true,
      data: registros
    });

  } catch (error) {
    return responderError(res, error, 'torre-control.obtenerEstadoTuneles');
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
    return responderError(res, error, 'torre-control.obtenerBitacora');
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
    return responderError(res, error, 'torre-control.ejecutarSincronizacionManual');
  }
};

module.exports = {
  obtenerEstadoTuneles,
  obtenerBitacora,
  ejecutarSincronizacionManual
};