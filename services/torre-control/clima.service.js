/*
    Author: German Valencia
    Pattern: PORTTOS Service - Condiciones del canal de acceso
    Description: Viento, visibilidad y marea del puerto (OpenWeather + WorldTides vía fuentes-externas.adapter).
      Sin datos de clima el canal se reporta "Sin datos", nunca "Abierto" por defecto.
*/
const { MAPA_PORTUARIO } = require('../../config/puertos.config');
const FuentesExternas = require('../../adapters/fuentes-externas.adapter');

const SIN_DATOS = { marea: 'N/A', pleamar: 'N/A', visibilidad: 'N/A', viento: 'N/A', estadoCanal: 'Sin datos', pilotaje: 'N/D' };
const VIENTO_RESTRICCION_NUDOS = 30;

const coordenadasPuerto = (puerto) => MAPA_PORTUARIO[String(puerto || '').toUpperCase()]?.coordenadas || null;

async function condicionesCanal(puerto) {
  const coordenadas = coordenadasPuerto(puerto);
  if (!coordenadas) return null;
  try {
    const [clima, mareas] = await Promise.all([
      FuentesExternas.getWeatherData(coordenadas.lat, coordenadas.lon),
      FuentesExternas.getTideData(coordenadas.lat, coordenadas.lon),
    ]);
    if (!clima) return { ...SIN_DATOS, marea: mareas?.nivel || 'N/A', pleamar: mareas?.hora || 'N/A' };
    const viento = clima?.wind?.speed;
    return {
      marea: mareas?.nivel || 'N/A',
      pleamar: mareas?.hora || 'N/A',
      visibilidad: clima?.visibility ? `${clima.visibility / 1000} km` : 'N/A',
      viento: viento != null ? `${viento} nudos` : 'N/A',
      estadoCanal: viento == null ? 'Sin datos' : viento > VIENTO_RESTRICCION_NUDOS ? 'Restringido' : 'Abierto',
      pilotaje: 'Normal',
    };
  } catch (error) {
    console.error('[Clima] Error consultando condiciones del canal:', error.message);
    return { ...SIN_DATOS };
  }
}

module.exports = { condicionesCanal, SIN_DATOS };
