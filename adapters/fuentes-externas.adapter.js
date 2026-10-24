/*
    Author: German Valencia
    Pattern: PORTTOS Adapter - Fuentes externas (clima, mareas, vías, alertas, noticias, avisos DIMAR)
    Description: Única puerta a las APIs de terceros que no tienen adaptador propio. No escribe en la base:
      devuelve datos normalizados (o null / [] si la fuente falla) y los servicios deciden qué guardar.
      Usa su propia instancia de axios con reintentos (antes los reintentos se aplicaban al axios global
      de toda la aplicación). Caché en memoria para no agotar cuotas.
      Antes vivía en services/torre-control/external-integration.service.js.
*/
const axios = require('axios');
const axiosRetry = require('axios-retry');
const NodeCache = require('node-cache');
const https = require('https');

const http = axios.create();
const aplicarReintentos = axiosRetry.default || axiosRetry;
aplicarReintentos(http, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => axiosRetry.isNetworkOrIdempotentRequestError(error),
});

// stdTTL en segundos (3600 = 1 hora)
const apiCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });

const getHeaders = (extraHeaders = {}) => ({
  headers: {
    'X-App-Token': process.env.SOCRATA_APP_TOKEN,
    'User-Agent': 'TorreControlLogistica-App/1.0',
    ...extraHeaders,
  },
});

// Algunas fuentes públicas colombianas sirven certificados incompletos.
const agent = new https.Agent({ rejectUnauthorized: false });

/** Zonas logísticas consultadas a TomTom (cada caja < 10.000 km², límite de la API) y su corredor. */
const ZONAS_TOMTOM = Object.freeze([
  { nombre: 'Pacífico', bbox: '-77.10,3.40,-76.20,4.00', corredor: 'Buga - Buenaventura' },
  { nombre: 'Cafetero', bbox: '-75.90,4.80,-75.40,5.40', corredor: 'Eje Cafetero' },
  { nombre: 'Centro', bbox: '-74.30,4.40,-73.90,4.90', corredor: 'Bogotá y salidas' },
  { nombre: 'Antioquia', bbox: '-75.70,6.00,-75.30,6.50', corredor: 'Valle de Aburrá y accesos' },
  { nombre: 'Caribe', bbox: '-75.10,10.30,-74.70,11.10', corredor: 'Cartagena - Barranquilla' },
]);

class FuentesExternasAdapter {

  // ==========================================
  // 1. CLIMA Y MAREAS (Stormglass API)
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
      const response = await http.get('https://www.dimar.mil.co/avisos-navegantes', { ...axiosConfig });

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
      // Seguridad 2026-10-17: la clave ya no va escrita en el código (estaba expuesta en el repositorio).
      // Sin WEATHER_API_KEY en el .env el clima responde null y los paneles muestran N/A.
      const apiKey = process.env.WEATHER_API_KEY;
      if (!apiKey) {
        if (!FuentesExternasAdapter._avisoSinClaveClima) {
          console.warn('⚠️ [Clima] Falta WEATHER_API_KEY en el .env: el clima del mapa y del tablero quedará en N/A');
          FuentesExternasAdapter._avisoSinClaveClima = true;
        }
        return null;
      }

      const response = await http.get(`https://api.openweathermap.org/data/2.5/weather`, {
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
      const response = await http.get(`https://www.worldtides.info/api/v3`, {
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
  /**
   * Incidentes vigentes de TomTom por zona logística (cajas < 10.000 km²), con el resultado de cada zona.
   * El ciclo de vida (utils/eventos-viales.js) solo cierra eventos de las zonas que respondieron bien.
   * Pide startTime, endTime, lastReportTime y delay; timeValidityFilter=present (solo lo vigente ahora).
   * @returns {Promise<{incidentes: Array<{zona: object, item: object}>, zonas: Array<{nombre, bbox, corredor, ok, error}>}>}
   */
  static async getEventosVialesPorZona() {
    const cacheKey = 'vias_tomtom_por_zona';
    if (apiCache.has(cacheKey)) return apiCache.get(cacheKey);

    const resultados = await Promise.all(ZONAS_TOMTOM.map((zona) =>
      http.get('https://api.tomtom.com/traffic/services/5/incidentDetails', {
        params: {
          key: process.env.TOMTOM_API_KEY,
          bbox: zona.bbox,
          language: 'es-ES',
          timeValidityFilter: 'present',
          fields: '{incidents{type,geometry{type,coordinates},properties{id,iconCategory,magnitudeOfDelay,from,to,startTime,endTime,lastReportTime,delay,events{description,code}}}}',
        },
      })
        .then((res) => ({ zona: { ...zona, ok: true, error: null }, incidentes: res.data?.incidents || [] }))
        .catch((err) => {
          const detalle = err.response?.data?.detailedError?.message || err.response?.data?.message || err.message;
          const codigo = err.response?.status ? `HTTP ${err.response.status}` : 'sin respuesta';
          console.warn(`⚠️ Error TomTom en zona ${zona.nombre} (${codigo}):`, detalle);
          return { zona: { ...zona, ok: false, error: `${codigo}: ${detalle}`.substring(0, 300) }, incidentes: [] };
        })));

    const salida = {
      incidentes: resultados.flatMap((r) => r.incidentes.map((item) => ({ zona: r.zona, item }))),
      zonas: resultados.map((r) => r.zona),
    };
    // Solo se guarda en caché si todas respondieron: una falla se reintenta en el siguiente ciclo
    if (salida.zonas.every((z) => z.ok)) apiCache.set(cacheKey, salida, 300);
    return salida;
  }

  /** Compatibilidad: solo la lista de incidentes (sin zona). */
  static async getEventosVialesOficiales() {
    const { incidentes } = await FuentesExternasAdapter.getEventosVialesPorZona();
    return incidentes.map((i) => i.item);
  }


  // ==========================================
  // 8. AIS (Automatic Identification System - MarineTraffic)
  // ==========================================
  static async getAlertasClimaticasOficiales() {
    // ID Dataset IDEAM/UNGRD
    const datasetId = 'm499-5285';
    try {
      const response = await http.get(`https://www.datos.gov.co/resource/${datasetId}.json`, {
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

FuentesExternasAdapter.ZONAS_TOMTOM = ZONAS_TOMTOM;
module.exports = FuentesExternasAdapter;