/*
    Author: German Dario Valencia Salazar
    Pattern: PORTTOS Service Pattern - Flota Terrestre (Sincronizado y Masivo)
*/
const FlotaTerrestreRepository = require('../../repositories/torre-control/flota-terrestre.repository');
const { cajaPuerto, cajaWkt, MARGEN } = require('../../helpers/caja-puerto.helper');
const SimuladorFlotaService = require('./simulador-flota.service');

class FlotaTerrestreService {

  // ==========================================
  // 1. GENERADOR DE GEOJSON PARA MAPLIBRE
  // ==========================================
  // async obtenerFlotaGeoJSON() {
  //   const camiones = await FlotaTerrestreRepository.obtenerDatosGeograficosFlota();

  //   return {
  //     type: 'FeatureCollection',
  //     features: (camiones || []).map(camion => ({
  //       type: 'Feature',
  //       geometry: {
  //         type: 'Point',
  //         coordinates: [camion.lon, camion.lat]
  //       },
  //       properties: {
  //         placa: camion.placa,
  //         modelo: camion.modelo || 'N/A',
  //         tipo_camion: camion.tipo_camion || 'Tractocamión',
  //         estado: camion.estado || 'EN_RUTA',
  //         velocidad: camion.velocidad || 0,
  //         conductor: camion.conductor || 'N/A',
  //         ultima_actualizacion: camion.ultima_actualizacion
  //       }
  //     }))
  //   };
  // }
  /** @param {string} [puerto] filtro opcional: flota en el corredor de acceso al puerto (agregado 2026-10-18) */
  async obtenerFlotaGeoJSON(puerto) {
    const caja = await cajaPuerto(puerto, MARGEN.TERRESTRE);
    const camiones = await FlotaTerrestreRepository.obtenerDatosGeograficosFlota(caja);

    return {
      type: 'FeatureCollection',
      features: (camiones || []).map(camion => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [camion.lon, camion.lat]
        },
        properties: {
          placa: camion.placa,
          marca: camion.marca || 'N/A', // 🟢 Agrégalo para que Angular lo pueda leer
          modelo: camion.modelo || 'N/A',
          tipo_camion: camion.tipo_camion || 'Tractocamión',
          estado: camion.estado || 'EN_RUTA',
          velocidad: camion.velocidad || 0,
          rumbo: camion.rumbo || 0,
          conductor: camion.conductor || 'N/A',
          ultima_actualizacion: camion.ultima_actualizacion
        }
      }))
    };
  }

  // ==========================================
  // 2. MOTOR VECTORIAL (Simulador Masivo Global)
  // ==========================================
  /**
   * Un ciclo del simulador (proceso 'simulador-flota' y GET /simular-tick). Desde 2026-10-19 lo hace
   * simulador-flota.service.js: avance por distancia, peajes, cola en portería, cargue y regreso.
   * Las alertas del mapa sobre la flota las corre el simulador cada 30 s.
   */
  async simularMovimientoFlota() {
    const movidos = await SimuladorFlotaService.ciclo();
    return { movidos, ...SimuladorFlotaService.resumen() };
  }

  // ==========================================
  // 3. UPSERT DE POSICIÓN REAL
  // ==========================================
  async upsertPosicion(dtoData) {
    await FlotaTerrestreRepository.upsertPosicion(dtoData);
    return true;
  }

  // ==========================================
  // 4. CAPA GEOCERCAS Y KPIS (Resuelve el error del controlador)
  // ==========================================
  async obtenerCapaGeocercas(puerto) {
    if (typeof FlotaTerrestreRepository.obtenerGeocercasConKPIs === 'function') {
      const caja = await cajaPuerto(puerto, MARGEN.TERRESTRE);
      const data = await FlotaTerrestreRepository.obtenerGeocercasConKPIs(caja ? cajaWkt(caja) : null);
      return data;
    }
    return [];
  }
}

// EXPORTAR INSTANCIA ÚNICA
module.exports = new FlotaTerrestreService();