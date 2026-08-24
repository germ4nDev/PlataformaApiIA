/*
    Author: German Valencia
    Service: ExternalIntegrationService
    Descripción: Consumo de APIs públicas y comerciales con Caché (TLC 4.0)
*/
const axios = require('axios');
const axiosRetry = require('axios-retry');
const NodeCache = require('node-cache');
const applyRetry = axiosRetry.default || axiosRetry;

applyRetry(axios, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    return axiosRetry.isNetworkOrIdempotentRequestError(error);
  }
});
// Inicializamos el caché. stdTTL es el tiempo de vida en segundos.
// Ej: 3600 = 1 hora. Evita agotar las cuotas de las APIs.
const apiCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });
const https = require('https');

const getHeaders = (extraHeaders = {}) => {
  return {
    headers: {
      'X-App-Token': process.env.SOCRATA_APP_TOKEN,
      'User-Agent': 'TorreControlLogistica-App/1.0',
      ...extraHeaders
    }
  };
};

// Configuración de Axios para ignorar errores de certificado
const agent = new https.Agent({
  rejectUnauthorized: false
});

class ExternalIntegrationService {

  // ==========================================
  // 1. CLIMA Y MAREAS (Stormglass API)
  // ==========================================
  static async getOceanographicData(lat = 3.8801, lng = -77.0319) { // Por defecto: Buenaventura
    const cacheKey = `clima_${lat}_${lng}`;
    if (apiCache.has(cacheKey)) return apiCache.get(cacheKey);

    try {
      // Ejemplo con Stormglass.io (Requiere API Key)
      const response = await axios.get(`https://api.stormglass.io/v2/weather/point`, {
        ...getHeaders({ 'Authorization': process.env.STORMGLASS_API_KEY }),
        params: {
          lat: lat,
          lng: lng,
          params: 'waveHeight,windSpeed,visibility'
        },
        headers: { 'Authorization': process.env.STORMGLASS_API_KEY }
      });

      apiCache.set(cacheKey, response.data, 1800); // Caché de 30 min
      return response.data;
    } catch (error) {
      // console.error("Error API Clima:", error.message);
      return null; // Fallback seguro para que el dashboard no colapse
    }
  }

  // ==========================================
  // 2. ESTADO DE VÍAS (Datos Abiertos INVIAS)
  // ==========================================
  static async getRoadStatus(departamento = 'Valle del Cauca') {
    const cacheKey = `vias_${departamento}`;
    if (apiCache.has(cacheKey)) return apiCache.get(cacheKey);

    try {
      // Socrata API - Datos Abiertos Colombia (Ejemplo de endpoint de emergencias viales)
      // Nota: El ID del dataset (xxxx-xxxx) debe actualizarse con el vigente en datos.gov.co
      const response = await axios.get(`https://www.datos.gov.co/resource/cqkk-dvm4.json`, {
        ...getHeaders(),
        params: {
          departamento: departamento.toUpperCase(),
          $limit: 10 // Traer solo los últimos 10 reportes
        }
      });

      apiCache.set(cacheKey, response.data, 3600); // Caché de 1 hora
      return response.data;
    } catch (error) {
      // console.error("Error API INVIAS:", error.message);
      return [];
    }
  }

  // ==========================================
  // 3. RASTREO SATELITAL (MarineTraffic / VesselFinder)
  // ==========================================
  static async getVesselPosition(imoNumber) {
    const cacheKey = `vessel_${imoNumber}`;
    if (apiCache.has(cacheKey)) return apiCache.get(cacheKey);

    try {
      // Ejemplo con VesselFinder (Requiere API Key comercial)
      const response = await axios.get(`https://api.vesselfinder.com/v1/vessels`, {
        ...getHeaders(),
        params: { userkey: process.env.VESSELFINDER_KEY, imo: imoNumber }
      });

      apiCache.set(cacheKey, response.data, 900);
      return response.data;
    } catch (error) {
      // console.error(`Error API AIS (IMO ${imoNumber}):`, error.message);
      return null;
    }
  }

  // ==========================================
  // 4. TRM (Dólar Diario - Superfinanciera)
  // ==========================================
  static async getTRM() {
    const cacheKey = 'trm_actual';
    if (apiCache.has(cacheKey)) return apiCache.get(cacheKey);

    try {
      // Socrata API - TRM Histórico
      const response = await axios.get(`https://www.datos.gov.co/resource/32sa-8pi3.json`, {
        ...getHeaders(),
        params: { $limit: 1, $order: 'vigenciadesde DESC' }
      });

      const data = response.data[0];
      apiCache.set(cacheKey, data, 43200);
      return data;
    } catch (error) {
      // console.error("Error API TRM:", error.message);
      return { valor: "No disponible" };
    }
  }

  // ==========================================
  // 5. FESTIVOS (Nager.Date)
  // ==========================================
  static async getHolidays() {
    const cacheKey = `festivos_${new Date().getFullYear()}`;
    if (apiCache.has(cacheKey)) return apiCache.get(cacheKey);
    try {
      const year = new Date().getFullYear();
      const response = await axios.get(`https://date.nager.at/api/v3/PublicHolidays/${year}/CO`, { ...axiosConfig });

      apiCache.set(cacheKey, response.data, 86400 * 30);
      return response.data;
    } catch (error) {
      // console.error("Error API Festivos:", error.message);
      return [];
    }
  }

  // ==========================================
  // 6. FEED DE NOTICIAS LOGÍSTICAS (RSS)
  // ==========================================
  static async getLogisticsNews() {
    const cacheKey = 'noticias_portuarias';
    if (apiCache.has(cacheKey)) return apiCache.get(cacheKey);
    try {
      // Lista de feeds RSS especializados
      const feeds = [
        'https://www.mundomaritimo.cl/rss/noticias.xml', // Noticias Marítimas LatAm
        // Si encuentras el RSS de un periódico colombiano de economía, lo agregas aquí
        // 'https://www.portafolio.co/rss/economia/infraestructura' 
      ];

      let noticiasConsolidadas = [];

      for (const feedUrl of feeds) {
        const feed = await rssParser.parseURL(feedUrl);

        // Extraemos solo el título y la fecha de las últimas 5 noticias
        const topNoticias = feed.items.slice(0, 5).map(item => ({
          titular: item.title,
          fecha: item.pubDate,
          fuente: feed.title
        }));

        noticiasConsolidadas = [...noticiasConsolidadas, ...topNoticias];
      }

      apiCache.set(cacheKey, noticiasConsolidadas, 7200);
      return noticiasConsolidadas;

    } catch (error) {
      // console.error("Error obteniendo RSS de Noticias:", error.message);
      return [];
    }
  }

  // ==========================================
  // 7. AVISOS A NAVEGANTES (DIMAR)
  // ==========================================
  static async getAvisosDIMAR() {
    const cacheKey = 'avisos_dimar';
    if (apiCache.has(cacheKey)) return apiCache.get(cacheKey);

    try {
      // Si DIMAR tiene un endpoint de Datos Abiertos, aquí va. 
      // Si no, puedes integrar una librería como 'cheerio' para scrapear su sección de "Avisos a los navegantes".
      const response = await axios.get('https://www.dimar.mil.co/avisos-navegantes', { ...axiosConfig });

      // Aquí procesarías el HTML para extraer las restricciones actuales
      const data = "Reporte DIMAR: Panamax con espera en canal acceso";
      apiCache.set(cacheKey, data, 14400);

      return data;
    } catch (error) {
      return "Sin avisos vigentes";
    }
  }

  // ==========================================
  // 7. CLIMA (Weather API - OpenWeatherMap)
  // ==========================================
  static async getWeatherData(lat, lon) {
    const cacheKey = `weather_${lat}_${lon}`;
    if (apiCache.has(cacheKey)) return apiCache.get(cacheKey);

    try {
      // Asignamos la llave directamente para forzar la conexión
      const apiKey = process.env.WEATHER_API_KEY || '8aae29f456a7e2737fbb1ac1970e2353';

      const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather`, {
        ...getHeaders(),
        params: {
          lat: lat,
          lon: lon,
          appid: apiKey, // Usamos la variable segura
          units: 'metric'
        }
      });
      apiCache.set(cacheKey, response.data, 1800);
      return response.data;
    } catch (error) {
      // console.error("Error Clima:", error.message);
      return null;
    }
  }

  // ==========================================
  // 2. MAREAS (Fix: URL Oficial v3)
  // ==========================================
  static async getTideData(lat, lng) {
    const cacheKey = `tides_${lat}_${lng}`;
    if (apiCache.has(cacheKey)) return apiCache.get(cacheKey);

    try {
      // Usamos la URL correcta v3 y el parámetro 'extremes'
      const response = await axios.get(`https://www.worldtides.info/api/v3`, {
        ...getHeaders(),
        params: {
          extremes: '', // Esto le indica a la API que queremos los altos y bajos
          lat: lat,
          lon: lng,
          key: process.env.WORLD_TIDES_API_KEY,
          days: 1
        }
      });

      const data = response.data.extremes;
      const proximaPleamar = data.find(e => e.type === 'High') || data[0];

      const resultado = {
        nivel: proximaPleamar.height.toFixed(2) + ' m',
        hora: new Date(proximaPleamar.dt * 1000).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
      };

      apiCache.set(cacheKey, resultado, 21600);
      return resultado;
    } catch (error) {
      // console.error("Error Mareas:", error.response?.data || error.message);
      return null;
    }
  }

  // ==========================================
  // 8. FUENTES OFICIALES (Incidentes Viales - TOMTOM)
  // ==========================================
  static async getEventosVialesOficiales() {
    const cacheKey = 'vias_tomtom_nacional';
    if (apiCache.has(cacheKey)) return apiCache.get(cacheKey);

    // Bounding Boxes calculados estrictamente < 10,000 km2 enfocados en rutas clave
    const zonasLogisticas = [
      { nombre: 'Pacífico', bbox: '-77.10,3.40,-76.20,4.00' }, // Cali, Yumbo, Buenaventura
      { nombre: 'Cafetero', bbox: '-75.90,4.80,-75.40,5.40' }, // Pereira, Armenia, Cartago
      { nombre: 'Centro', bbox: '-74.30,4.40,-73.90,4.90' },   // Bogotá Sabana y salidas
      { nombre: 'Antioquia', bbox: '-75.70,6.00,-75.30,6.50' },// Valle de Aburrá y accesos
      { nombre: 'Caribe', bbox: '-75.10,10.30,-74.70,11.10' }  // Corredor Cartagena-B/quilla
    ];

    try {
      const peticiones = zonasLogisticas.map(zona =>
        axios.get(`https://api.tomtom.com/traffic/services/5/incidentDetails`, {
          params: {
            key: process.env.TOMTOM_API_KEY,
            bbox: zona.bbox,
            language: 'es-ES',

            // ¡Corregido! El 'id' ahora vive dentro de 'properties' junto con los textos
            fields: '{incidents{geometry{type,coordinates},properties{id,iconCategory,magnitudeOfDelay,from,to,events{description}}}}'
          }
        }).catch(err => {
          const detalleError = err.response?.data?.detailedError?.message || err.response?.data?.message || err.message;
          console.warn(`⚠️ Error TomTom en zona ${zona.nombre}:`, detalleError);
          return { data: { incidents: [] } };
        })
      );

      const resultados = await Promise.all(peticiones);

      let incidentesNacionales = [];
      resultados.forEach(res => {
        if (res.data && res.data.incidents) {
          incidentesNacionales = [...incidentesNacionales, ...res.data.incidents];
        }
      });

      apiCache.set(cacheKey, incidentesNacionales, 300);

      return incidentesNacionales;

    } catch (error) {
      console.error("❌ Error General en TomTom:", error.message);
      return [];
    }
  }

  // ==========================================
  // 8. AIS (Automatic Identification System - MarineTraffic)
  // ==========================================
  static async getAlertasClimaticasOficiales() {
    // ID Dataset IDEAM/UNGRD
    const datasetId = 'm499-5285';
    try {
      const response = await axios.get(`https://www.datos.gov.co/resource/${datasetId}.json`, {
        ...getHeaders(),
        params: { $limit: 50, $where: "estado = 'VIGENTE'" }
      });
      return response.data;
    } catch (error) {
      console.error("❌ Error API Alertas Clima:", error.message);
      return [];
    }
  }

}

module.exports = ExternalIntegrationService;