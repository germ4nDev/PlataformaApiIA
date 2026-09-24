/*
    Author: German Dario Valencia Salazar
    Pattern: PORTTOS Service Pattern - Flota Terrestre (Sincronizado y Masivo)
*/
const FlotaTerrestreRepository = require('../../repositories/torre-control/flota-terrestre.repository');
const { io } = require('../../index');

class FlotaTerrestreService {

  constructor() {
    // Memoria para control de alertas de geocercas sin spam
    this.memoriaZonas = new Map();
  }

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
  async obtenerFlotaGeoJSON() {
    const camiones = await FlotaTerrestreRepository.obtenerDatosGeograficosFlota();

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
  async simularMovimientoFlota() {
    try {
      // Ejecuta la actualización masiva de toda la flota en SQL Server (sin offsets)
      const result = await FlotaTerrestreRepository.ejecutarMotorVectorial();

      const movidos = (result && result[0] && result[0][0]) ? result[0][0].FilasMovidas : 0;

      // Detección opcional de eventos en geocercas
      const camionesEnZona = await FlotaTerrestreRepository.detectarEventosGeocerca();
      if (camionesEnZona && Array.isArray(camionesEnZona)) {
        for (const evento of camionesEnZona) {
          if (!this.memoriaZonas.has(evento.placa)) {
            this.memoriaZonas.set(evento.placa, evento.Lugar);
            const mensaje = `🚛 ${evento.placa} ingresó a ${evento.Lugar}`;

            const esCritico = evento.Lugar && evento.Lugar.includes('Crítico');
            if (esCritico) {
              const payload = {
                placa: evento.placa,
                geocerca: evento.Lugar,
                mensaje: mensaje,
                fecha: new Date()
              };
              const socketGlobal = io || require('../../index').io;
              if (socketGlobal) {
                socketGlobal.emit('alerta-terrestre', payload);
              }
            }
          }
        }
      }

      return movidos;
    } catch (error) {
      console.error("❌ Error en el servicio de simulación:", error.message);
      throw error;
    }
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
  async obtenerCapaGeocercas() {
    if (typeof FlotaTerrestreRepository.obtenerGeocercasConKPIs === 'function') {
      const data = await FlotaTerrestreRepository.obtenerGeocercasConKPIs();
      return data;
    }
    return [];
  }
}

// EXPORTAR INSTANCIA ÚNICA
module.exports = new FlotaTerrestreService();