const { MAPA_PORTUARIO } = require('../../config/puertos.config');
const ExternalIntegrationService = require('../../services/torre-control/external-integration.service');

const obtenerClimaPuerto = async (req, res) => {
  const { puerto } = req.query;

  const puertoConfig = MAPA_PORTUARIO[puerto]; // Accedemos a la config completa
  const coordenadas = puertoConfig?.coordenadas;

  if (!coordenadas) {
    return res.status(404).json({ error: 'Puerto no encontrado en configuración' });
  }

  try {
    const [clima, mareas] = await Promise.all([
      ExternalIntegrationService.getWeatherData(coordenadas.lat, coordenadas.lon),
      ExternalIntegrationService.getTideData(coordenadas.lat, coordenadas.lon)
    ]);

    if (!clima) {
      return res.status(503).json({ error: 'Servicio meteorológico no disponible' });
    }

    const respuesta = {
      marea: mareas.nivel,
      pleamar: mareas.hora,
      visibilidad: (clima.current.visibility / 1000) + ' km',
      viento: clima.current.wind_speed + ' nudos',
      estadoCanal: clima.current.wind_speed > 30 ? 'Restringido' : 'Abierto',
      pilotaje: 'Normal'
    };

    res.json(respuesta);

  } catch (error) {
    console.error("Error en ClimaController:", error);
    res.json({
      marea: 'N/A',
      visibilidad: 'N/A',
      viento: 'N/A',
      estadoCanal: 'Abierto',
      pilotaje: 'Normal'
    });
    // res.status(500).json({ error: 'Error interno al procesar datos climáticos' });
  }
}

const obtenerClimaPuertoRuta = async (req, res) => {
  const { puerto } = req.params;
  const puertoConfig = MAPA_PORTUARIO[puerto?.toUpperCase()];
  const coordenadas = puertoConfig?.coordenadas;

  // Si no hay coordenadas, devolvemos N/A en lugar de 404
  if (!coordenadas) {
    return res.json({ marea: 'N/A', visibilidad: 'N/A', viento: 'N/A', estadoCanal: 'Abierto', pilotaje: 'Normal' });
  }

  try {
    const [clima, mareas] = await Promise.all([
      ExternalIntegrationService.getWeatherData(coordenadas.lat, coordenadas.lon),
      ExternalIntegrationService.getTideData(coordenadas.lat, coordenadas.lon)
    ]);

    // console.log("DATOS CLIMA RECIBIDOS EN CONTROLADOR:", clima);

    // Ensamblamos la respuesta. Usamos el operador ?. por si clima o mareas vienen vacíos
    const respuesta = {
      marea: mareas?.nivel || 'N/A',
      pleamar: mareas?.hora || 'N/A',
      // OJO: Ya no es clima.current.visibility, es directo clima.visibility
      visibilidad: clima?.visibility ? (clima.visibility / 1000) + ' km' : 'N/A',
      // OJO: Ya no es clima.current.wind_speed, es clima.wind.speed
      viento: clima?.wind?.speed ? clima.wind.speed + ' nudos' : 'N/A',
      estadoCanal: (clima?.wind?.speed > 30) ? 'Restringido' : 'Abierto',
      pilotaje: 'Normal'
    };

    // Siempre respondemos 200 OK con los datos (reales o de respaldo)
    res.json(respuesta);

  } catch (error) {
    console.error("Error en ClimaController:", error);
    // Si ocurre un error catastrófico, también devolvemos valores por defecto, NUNCA un 500/503
    res.json({
      marea: 'N/A',
      visibilidad: 'N/A',
      viento: 'N/A',
      estadoCanal: 'Abierto',
      pilotaje: 'Normal'
    });
  }
};

module.exports = {
  obtenerClimaPuerto,
  obtenerClimaPuertoRuta
};