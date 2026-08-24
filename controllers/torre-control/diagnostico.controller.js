const { BitacoraSincronizacion } = require('../../models');
// Importa aquí tus servicios para poder llamarlos en el Dry-Run
const SincronizacionService = require('../../services/torre-control/sincronizacion.service');

const obtenerEstadoTuneles = async (req, res) => {
  try {
    const logs = await BitacoraSincronizacion.findAll({
      order: [['createdAt', 'DESC']],
      limit: 50
    });
    res.status(200).json({ ok: true, data: logs });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
};

const ejecutarDryRun = async (req, res) => {
  const { tunel } = req.params;

  try {
    let payloadDeMuestra = null;

    switch (tunel) {
      case 'eventos-viales':
        // IMPORTANTE: Tendrás que modificar temporalmente tu servicio para que si le pasas
        // un parámetro (ej. dryRun = true), retorne el JSON mapeado SIN hacer el bulkCreate
        payloadDeMuestra = await SincronizacionService.sincronizarEventosViales({ dryRun: true });
        break;

      // Agrega otros casos aquí según vayas necesitando
      default:
        return res.status(404).json({ ok: false, mensaje: 'Túnel no reconocido' });
    }

    res.status(200).json({
      ok: true,
      mensaje: `Dry Run exitoso para ${tunel}. Verifica el payload.`,
      payload: payloadDeMuestra // Aquí verás exactamente qué intentas insertar
    });

  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
      stack: error.stack // Útil para depurar desde el cliente REST
    });
  }
};

module.exports = {
  obtenerEstadoTuneles,
  ejecutarDryRun
};