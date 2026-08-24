/*
    Author: German Dario Valencia Salazar
    Pattern: QPLUS Service Pattern - Flota Terrestre
*/
const FlotaTerrestreRepository = require('../../repositories/torre-control/flota-terrestre.repository');
const { io } = require('../../index');

class FlotaTerrestreService {

  constructor() {
    // Encapsulamos el estado dentro de la instancia para evitar problemas de alcance
    this.currentOffset = 0;
    this.BATCH_SIZE = 1000;
    this.TOTAL_CAMIONES = 16000;

    // 🟢 SOLUCIÓN AL ERROR: Inicializamos memoriaZonas como un Map() para poder usar .has() y .set()
    this.memoriaZonas = new Map();
  }

  // ==========================================
  // 1. GENERADOR DE GEOJSON PARA MAPLIBRE
  // ==========================================
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
          id: camion._id,
          placa: camion.placa,
          modelo: camion.modelo,
          tipo_camion: camion.tipo_camion,
          estado_camion: camion.estado_camion,
          velocidad: camion.velocidad
        }
      }))
    };
  }

  // ==========================================
  // 2. MOTOR VECTORIAL V2 (SIMULADOR DE FLOTA)
  // ==========================================
  async simularMovimientoFlota() {
    try {
      // 1. Ejecutamos el repositorio con el estado interno de la instancia
      const result = await FlotaTerrestreRepository.ejecutarMotorVectorial(this.currentOffset, this.BATCH_SIZE);

      // 2. Detectas quiénes están en zonas críticas
      const camionesEnZona = await FlotaTerrestreRepository.detectarEventosGeocerca(this.currentOffset, this.BATCH_SIZE);
      // 3. Lógica de registro en Memoria (evita spam)
      // Validamos que camionesEnZona sea un array para evitar errores si SQL falla
      // 3. Lógica de registro en Memoria (evita spam)
      // Validamos que camionesEnZona sea un array para evitar errores si SQL falla
      if (camionesEnZona && Array.isArray(camionesEnZona)) {
        for (const evento of camionesEnZona) {

          if (!this.memoriaZonas.has(evento.placa)) {
            // EL CAMIÓN ACABA DE ENTRAR
            this.memoriaZonas.set(evento.placa, evento.Lugar);

            const mensaje = `🚛 ${evento.placa} ingresó a ${evento.Lugar}`;
            console.log(mensaje);

            // 🟢 AQUÍ VA EL EMIT PARA EL TOAST EN ANGULAR
            // Tip: Si tu evento.Lugar ya trae la palabra "Crítico" (como vimos en tu consola), 
            // usamos un includes() para filtrar y enviar solo emergencias reales al frontend.
            const esCritico = evento.Lugar && evento.Lugar.includes('Crítico');

            if (esCritico) {
              const payload = {
                placa: evento.placa,
                geocerca: evento.Lugar,
                mensaje: mensaje,
                fecha: new Date()
              };

              // Vamos a ver qué camino está tomando Node.js
              const socketGlobal = io || require('../../index').io;

              if (socketGlobal) {
                socketGlobal.emit('alerta-terrestre', payload);
                // Si ves este mensaje, el backend hizo su trabajo perfecto
                console.log(`📡 Socket Emitido al Frontend -> ${evento.placa}`);
              } else {
                console.log(`❌ ERROR FATAL: El objeto 'io' sigue siendo undefined. No se pudo emitir.`);
              }
            }
          }
        }
      }

      // Log para monitoreo
      const movidos = (result && result[0] && result[0][0]) ? result[0][0].FilasMovidas : 0;
      console.log(`🚛 [SERVICE] Lote (Offset: ${this.currentOffset}) procesado. Camiones movidos: ${movidos}`);

      // Incrementamos para el siguiente tick
      this.currentOffset += this.BATCH_SIZE;

      // Resetear si llegamos al final de la flota
      if (this.currentOffset >= this.TOTAL_CAMIONES) {
        this.currentOffset = 0;
        // Opcional: Si quieres limpiar la memoria cada ciclo completo
        // this.memoriaZonas.clear(); 
      }
    } catch (error) {
      console.error("❌ Error en el servicio de simulación:", error.message);
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
  // 4. CAPA GEOCERCAS
  // ==========================================
  async obtenerCapaGeocercas() {
    // Valida si esta función existe en tu Repositorio, la agregamos en los pasos anteriores.
    if (typeof FlotaTerrestreRepository.obtenerGeocercasConKPIs === 'function') {
      const data = await FlotaTerrestreRepository.obtenerGeocercasConKPIs();
      return data;
    }
    return [];
  }
}

// EXPORTAR INSTANCIA
module.exports = new FlotaTerrestreService();