/*
    Author: German Valencia
    Pattern: PORTTOS Controller - Condiciones del canal
*/
const ClimaService = require('../../services/torre-control/clima.service');
const { manejar } = require('../../helpers/controlador.helper');

/** GET ?puerto= — 404 si el puerto no está configurado. */
const obtenerClimaPuerto = manejar('Clima.puerto', async (req, res) => {
  const condiciones = await ClimaService.condicionesCanal(req.query.puerto);
  if (!condiciones) return res.status(404).json({ error: 'Puerto no encontrado en configuración' });
  return res.json(condiciones);
});

/** GET /canales/:puerto — siempre responde (sin configuración: "Sin datos"). */
const obtenerClimaPuertoRuta = manejar('Clima.canal', async (req, res) => {
  const condiciones = await ClimaService.condicionesCanal(req.params.puerto);
  return res.json(condiciones || ClimaService.SIN_DATOS);
});

module.exports = { obtenerClimaPuerto, obtenerClimaPuertoRuta };
