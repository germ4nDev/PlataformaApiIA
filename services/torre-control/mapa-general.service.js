/*
    Author: German Valencia
    Pattern: QPLUS Service - Mapa General (Gemelo Digital)
    Descripción: Orquestador limpio de capas espaciales (Vías, Infraestructura, Terrestre, Clima, Incidentes).
*/
const fs = require('fs');
const path = require('path');
const ExternalIntegrationService = require('./external-integration.service');
const MaritimoRepository = require('../../repositories/torre-control/mapa-general.repository');

class MapaGeneralService {
  constructor(repository) {
    this.repository = repository;
  }

  // ==========================================
  // 1. CAPA INFRAESTRUCTURA
  // ==========================================
  async getCapaInfraestructura() {
    try {
      const data = await this.repository.getInfraestructuraJerarquica();
      if (!data || data.length === 0) {
        return { success: true, data: [] };
      }
      return { success: true, data: data };
    } catch (error) {
      console.error('❌ ERROR REAL DE BASE DE DATOS [Infraestructura]:', error);
      throw error;
    }
  }

  // ==========================================
  // 2. CAPA TERRESTRE (GPS FLOTA)
  // ==========================================
  async getCapaTerrestre() {
    try {
      const flota = await this.repository.getFlotaTerrestreActiva();
      const geoJson = {
        type: 'FeatureCollection',
        features: flota.map(v => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [parseFloat(v.longitud), parseFloat(v.latitud)]
          },
          properties: {
            capa: 'TERRESTRE',
            placa: v.placa,
            estado: v.estado,
            conductor: v.conductor,
            velocidad: v.velocidad
          }
        }))
      };
      return { success: true, data: geoJson };
    } catch (error) {
      console.error("🔥 [Terrestre] Error en orquestación:", error);
      throw new Error('Fallo al generar la capa terrestre.');
    }
  }

  // ==========================================
  // 3. CAPA CLIMA (IDEAM / OPENWEATHER)
  // ==========================================
  async getCapaClima() {
    try {
      const puertos = await this.repository.getInfraestructuraActiva();
      const promesas = puertos.map(p => ExternalIntegrationService.getWeatherData(p.lat, p.lon));
      const resultados = await Promise.all(promesas);

      const geoJson = {
        type: 'FeatureCollection',
        features: resultados.filter(w => w).map((w, i) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [puertos[i].lon, puertos[i].lat] },
          properties: {
            zona: puertos[i].nombre,
            temp: w.main?.temp,
            descripcion: w.weather?.[0]?.description
          }
        }))
      };
      return { success: true, data: geoJson };
    } catch (error) {
      console.error("🔥 [Clima] Error en orquestación:", error);
      throw new Error('Fallo al generar la capa de clima.');
    }
  }

  // ==========================================
  // 4. CAPA VIAS + INCIDENTES (CRUCE INTELIGENTE)
  // ==========================================
  async getCapaVialEnriquecida() {
    try {
      // 1. Cargar Vías (Local) e Incidentes (DB) en paralelo
      const [vias, incidentes] = await Promise.all([
        this._leerGeoJsonVias(),
        this.repository.getIncidentesVialesActivos()
      ]);

      // 2. Cruce inteligente
      const viasEnriquecidas = this._cruzarViasConIncidentes(vias, incidentes);

      return { success: true, data: viasEnriquecidas };
    } catch (error) {
      console.error("🔥 [Vías/Incidentes] Error en orquestación:", error);
      throw new Error('Fallo al consolidar la capa vial.');
    }
  }

  _leerGeoJsonVias() {
    try {
      // Ajusta esta ruta a la carpeta donde alojarás tus archivos GeoJSON oficiales
      const ruta = path.join(__dirname, '../../../data/Red_Vial_20260626.geojson');
      const data = fs.readFileSync(ruta, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('❌ Error leyendo GeoJSON de vías:', error);
      return { type: 'FeatureCollection', features: [] };
    }
  }

  _cruzarViasConIncidentes(vias, incidentes) {
    if (!vias.features) return vias;

    // Indexamos incidentes para búsqueda O(1) basada en el nombre del tramo
    const incidentesMap = incidentes.reduce((acc, inc) => {
      const key = this._normalizarString(inc.tramo_nombre || inc.ID_VIAL);
      acc[key] = inc;
      return acc;
    }, {});

    // Enriquecemos la red vial
    return {
      ...vias,
      features: vias.features.map(f => {
        const nombreVial = this._normalizarString(f.properties.nombre_tramo || f.properties.ID);
        const incidente = incidentesMap[nombreVial];

        return {
          ...f,
          properties: {
            ...f.properties,
            estado: incidente ? 'congestionado' : 'libre',
            incidente_tipo: incidente ? incidente.tipo_evento : null,
            severidad: incidente ? incidente.nivel_severidad : 0
          }
        };
      })
    };
  }

  // ==========================================
  // 5. CAPA NAVES
  // ==========================================
  async getCapaNaves() {
    try {
      const naves = await this.repository.getUltimasPosicionesNaves();
      return { success: true, data: naves };
    } catch (error) {
      console.error('❌ [Naves] Error en Capa Naves:', error);
      throw new Error('Fallo al generar la capa de naves.');
    }
  }

  // ==========================================
  // SIMULACIÓN
  // ==========================================
  async simularMovimientoFlota() {
    try {
      return await this.repository.actualizarPosicionesSimuladas();
    } catch (error) {
      console.error('❌ Error al ejecutar simularMovimientoFlota:', error);
      throw error;
    }
  }

  // ==========================================
  // SINCRONIZACION OPTIMIZADA
  // ==========================================
  async ejecutarSincronizacionCompleta() {
    try {
      // 1. Sincronizar Eventos Viales
      const eventos = await ExternalIntegrationService.getEventosVialesOficiales();
      const promesasEventos = eventos.map(item =>
        this.repository.upsertEventoVial(this._mapearEventoVial(item))
      );
      await Promise.all(promesasEventos);

      // 2. Sincronizar Alertas Climáticas
      const alertas = await ExternalIntegrationService.getAlertasClimaticasOficiales();
      const promesasAlertas = alertas.map(item =>
        this.repository.upsertAlertaClimatica(this._mapearAlertaClimatica(item))
      );
      await Promise.all(promesasAlertas);
    } catch (error) {
      console.error("❌ Error grave durante la sincronización:", error);
    }
  }

  async diagnosticarEsquemaFuente(fuente = 'vial') {
    try {
      let datos = [];
      if (fuente === 'vial') {
        datos = await ExternalIntegrationService.getEventosVialesOficiales();
      } else if (fuente === 'clima') {
        datos = await ExternalIntegrationService.getAlertasClimaticasOficiales();
      }

      if (datos && datos.length > 0) {
        console.dir(datos[0], { depth: null });
      } else {
        console.warn("⚠️ La API devolvió un array vacío o falló.");
      }
    } catch (error) {
      console.error("❌ Error en diagnóstico:", error);
    }
  }

  async obtenerDashboardMaritimo() {
    // Aquí podrías agregar lógica de negocio adicional (ej. transformar WKT a GeoJSON)
    // Por ahora, retornamos la data enriquecida con el estado espacial
    const data = await this.repository.getBuquesConEstadoOperativo();

    return data.map(item => ({
      ...item,
      timestamp: new Date().toISOString(), // Añadir meta-data de consulta
      fuente: 'AIS-Spatial-Correlation'
    }));
  }

  // Mapeo específico para dbo.TCLEventosViales
  _mapearEventoVial(item) {
    return {
      codigoEvento: item.uuid || item.id_unico,
      corredorVial: item.nombre_via || 'N/A',
      sector: item.ubicacion || 'N/A',
      tipoEvento: item.tipo_evento || 'GENERAL',
      descripcion: item.descripcion_corta || '',
      nivelSeveridad: parseInt(item.impacto) || 1,
      estadoEvento: 'ACTIVO',
      fechalnicio: item.fecha_reporte || new Date(),
      codigousuariocreacion: 'SYSTEM_CRON',
      fechacreacion: new Date()
    };
  }

  // Mapeo específico para dbo.TCLAlertasClimaticas
  _mapearAlertaClimatica(item) {
    return {
      codigoAlerta: item.id_alerta,
      region: item.zona_afectada || 'N/A',
      corredorVial: item.corredor || 'N/A',
      sector: item.sector || 'N/A',
      tipoAlerta: item.tipo || 'CLIMA',
      descripcion: item.detalle || '',
      intensidadPrecipitacion: parseFloat(item.precipitacion) || 0,
      velocidadViento: parseFloat(item.viento) || 0,
      visibilidadEstimada: parseInt(item.visibilidad) || 10,
      nivelSeveridad: parseInt(item.nivel) || 1,
      estadoAlerta: 'ACTIVO',
      fechalnicio: item.fecha || new Date(),
      codigousuariocreacion: 'SYSTEM_CRON',
      fechacreacion: new Date()
    };
  }

  // ==========================================
  // UTILS
  // ==========================================
  _normalizarString(str) {
    if (!str) return 'unknown';
    return str.toString().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Limpieza de tildes
      .replace(/[^a-z0-9]/g, ''); // Limpieza de caracteres especiales
  }

  _emptyGeoJson() {
    return { type: 'FeatureCollection', features: [] };
  }
}

module.exports = MapaGeneralService;