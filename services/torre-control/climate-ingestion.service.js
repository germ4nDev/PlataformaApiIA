/*
    Author: German Valencia
    Service: Ingesta Climática Automatizada (Nacional y Dinámica)
*/
const axios = require('axios');
const { AlertaClimaticaDTO } = require('../../models/torre-control/alerta-climatica.model');
const AlertaClimaticaService = require('./../../services/torre-control/alertaClimatica.service');
const NodoMonitoreoService = require('./../../services/torre-control/nodo-monitoreo.service');

// Contexto único de auditoría para el proceso en segundo plano
const SYSTEM_CONTEXT = { codigoUsuario: 'SYSTEM_CRON_IDEAM' };
const WEATHER_API_URL = 'https://api.open-meteo.com/v1/forecast';

const ClimateIngestionService = {

  ejecutarIngesta: async (sequelizeInstance) => {
    try {
      // 1. EXTRACT: Consultar los puntos logísticos estratégicos activos en Base de Datos
      const nodosActivos = await NodoMonitoreoService.obtenerNodosActivos(sequelizeInstance);

      if (!nodosActivos || nodosActivos.length === 0) {
        console.log('[ETL WARNING] No hay nodos de monitoreo configurados en la base de datos.');
        return;
      }

      // 2. TRANSFORM & LOAD: Procesamiento iterativo resiliente por cada nodo
      for (const nodo of nodosActivos) {
        try {
          // Fetch de métricas reales para las coordenadas específicas del nodo
          const métricasClima = await consultarAPIClimatica(nodo.latitud, nodo.longitud);

          if (!métricasClima) continue; // Si falla la API para este nodo, avanza al siguiente

          // Aplicar Reglas de Negocio para determinar Severidad y Alerta
          const analisisRiesgo = determinarNivelRiesgo(métricasClima);

          // Construcción de la estructura cruda unificando Master Data + Live Data
          const rawAlerta = {
            corredorVial: nodo.corredorVial,
            sector: nodo.nombreSector,
            tipoAlerta: analisisRiesgo.tipoAlerta,
            descripcion: analisisRiesgo.descripcion,
            intensidadPrecipitacion: métricasClima.precipitation,
            velocidadViento: métricasClima.windSpeed,
            visibilidadEstimada: métricasClima.visibility,
            nivelSeveridad: analisisRiesgo.nivelSeveridad,
            estadoAlerta: 'ACTIVO',
            fechaInicio: new Date().toISOString()
          };

          // El Escudo: Validación y transformación del patrón QPLUS
          const dataValidada = AlertaClimaticaDTO(rawAlerta, SYSTEM_CONTEXT);

          // Persistencia asíncrona controlada en el modelo relacional
          await AlertaClimaticaService.persistirAlerta(dataValidada, sequelizeInstance);
        } catch (err) {
          // Aislamiento de errores: Una falla en un nodo no destruye la ejecución de los demás
          console.error(`[ETL ERROR] Error procesando el nodo ${nodo.nombreSector}:`, err.details || err.message);
        }
      }
    } catch (error) {
      console.error('[ETL CRITICAL ERROR] Fallo catastrófico en el pipeline principal:', error);
    }
  }
};

/**
 * Realiza la petición HTTP asíncrona hacia el proveedor satelital global
 */
async function consultarAPIClimatica(latitud, longitud) {
  try {
    const response = await axios.get(WEATHER_API_URL, {
      params: {
        latitude: latitud,
        longitude: longitud,
        current: 'precipitation,wind_speed_10m,visibility',
        timezone: 'auto'
      },
      timeout: 5000 // Tiempo de espera máximo de 5 segundos para evitar colgar el proceso
    });

    const currentData = response.data?.current;
    if (!currentData) return null;

    return {
      precipitation: currentData.precipitation || 0,        // mm
      windSpeed: currentData.wind_speed_10m || 0,           // km/h
      visibility: currentData.visibility ? Math.round(currentData.visibility) : 10000 // metros
    };
  } catch (error) {
    console.error(`[API WEATHER ERROR] No se pudo obtener clima para coord [${latitud}, ${longitud}]:`, error.message);
    return null;
  }
}

/**
 * Matriz de reglas de negocio para la Torre de Control Logística
 */
function determinarNivelRiesgo(clima) {
  // Inicialización por defecto (Condición segura)
  let nivelSeveridad = 1;
  let tipoAlerta = 'NORMAL';
  let descripcion = 'Operación normal, condiciones óptimas de visibilidad y tracción.';

  // Regla 1: Alertas Críticas de Nivel 3 (Rojo) - Detención/Parálisis operativa
  if (clima.precipitation > 10 || clima.visibility < 300) {
    nivelSeveridad = 3;
    tipoAlerta = clima.precipitation > 10 ? 'LLUVIA_FUERTE' : 'NIEBLA_BAJA_VISIBILIDAD';
    descripcion = clima.precipitation > 10
      ? `Precipitación severa (${clima.precipitation} mm/h). Alto riesgo de aquaplaning.`
      : `Visibilidad crítica inferior a 300 metros por niebla densa.`;
  }
  // Regla 2: Alertas Moderadas de Nivel 2 (Naranja) - Operación con precaución
  else if (clima.precipitation > 2 || clima.windSpeed > 45 || clima.visibility < 1500) {
    nivelSeveridad = 2;
    tipoAlerta = clima.precipitation > 2 ? 'LLUVIA_MODERADA' : (clima.windSpeed > 45 ? 'VIENTOS_FUERTES' : 'NIEBLA_BAJA_VISIBILIDAD');
    descripcion = `Condiciones adversas moderadas. Reducir velocidad preventiva en el tramo vial.`;
  }

  return { nivelSeveridad, tipoAlerta, descripcion };
}

module.exports = ClimateIngestionService;