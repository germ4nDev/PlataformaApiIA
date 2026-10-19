/*
    Author: German Valencia
    Pattern: PORTTOS Adapter - Open-Meteo
    Description: Clima actual en un punto (precipitación, viento, visibilidad). Sin clave.
      Devuelve null si la fuente no responde; nunca escribe en la base.
*/
const axios = require('axios');

const URL = 'https://api.open-meteo.com/v1/forecast';

async function climaActual(latitud, longitud) {
  try {
    const { data } = await axios.get(URL, {
      params: { latitude: latitud, longitude: longitud, current: 'precipitation,wind_speed_10m,visibility', timezone: 'auto' },
      timeout: 5000,
    });
    const actual = data?.current;
    if (!actual) return null;
    return {
      precipitation: actual.precipitation || 0, // mm
      windSpeed: actual.wind_speed_10m || 0, // km/h
      visibility: actual.visibility ? Math.round(actual.visibility) : 10000, // m
    };
  } catch (error) {
    console.error(`[Open-Meteo] Sin clima para [${latitud}, ${longitud}]:`, error.message);
    return null;
  }
}

module.exports = { climaActual };

/** Clima marino actual (viento en nudos, temperatura, código de tiempo). null si la fuente no responde. */
async function climaMarino(latitud, longitud) {
  try {
    const { data } = await axios.get(URL, {
      params: { latitude: latitud, longitude: longitud, current_weather: true, windspeed_unit: 'kn' },
      timeout: 8000,
    });
    const actual = data?.current_weather;
    if (!actual) return null;
    return { vientoNudos: actual.windspeed, temperatura: actual.temperature, codigoTiempo: actual.weathercode };
  } catch (error) {
    console.error(`[Open-Meteo] Sin clima marino para [${latitud}, ${longitud}]:`, error.message);
    return null;
  }
}

module.exports.climaMarino = climaMarino;
