/*
    Author: German Valencia
    Pattern: PORTTOS Service - Motor Central de Georreferenciación (PRODUCCIÓN)
    Descripción: Unifica datos espaciales (Marítimos, Terrestres, Infraestructura),
                 los transforma al estándar GeoJSON y administra las salas (Rooms) 
                 de Socket.IO para distribución optimizada de capas.
*/
const MaritimoRepository = require('../../repositories/torre-control/maritimo.repository');
// 🟢 IMPORTACIÓN CORREGIDA: Traemos el repositorio de motonaves
const motonavesRepository = require('../../repositories/torre-control/motonaves.repository');
// const TerrestreRepository = require('../../repositories/torre-control/terrestre.repository'); 
// const InfraestructuraRepository = require('../../repositories/maestros/infraestructura.repository');

class GeoreferenciacionService {
  constructor() {
    this.io = null;
  }

  inicializar(ioInstance) {
    if (!ioInstance) {
      console.error('❌ [Geo Service] Se requiere la instancia de Socket.IO para inicializar.');
      return;
    }

    this.io = ioInstance;
    this._configurarEventosSocket();
  }

  // ================================================================
  // 🛠️ MOTOR DE TRADUCCIÓN GEOJSON
  // ================================================================

  _crearGeoJSON(naves, tipo) {
    return {
      type: 'FeatureCollection',
      features: naves.map(n => {
        // 🟢 SOLUCIÓN AL FILTRO ASESINO: Soportamos múltiples nomenclaturas (lat/lon o latitud/longitud)
        const lat = parseFloat(n.latitud || n.lat || 0);
        const lon = parseFloat(n.longitud || n.lon || 0);

        return {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [lon, lat]
          },
          properties: {
            capa: tipo,
            nombre_motonave: n.nombreMotonave || n.motonave || n.nombre_motonave,
            agencia: n.agencia,
            mmsi: n.mmsi,
            velocidad: n.velocidad,
            rumbo: n.rumbo,
            destino: n.destino,
            estadoInferido: n.estadoInferido
          }
        };
      }).filter(f => f.geometry.coordinates[0] !== 0 && f.geometry.coordinates[1] !== 0) // Filtro seguro que ahora sí funciona
    };
  }

  // ================================================================
  // 📦 EXTRACCIÓN Y EMISIÓN DE CAPAS (ESTADO INICIAL)
  // ================================================================

  async emitirCapaMaritimaInicial(socket = null) {
    try {
      const navesActivas = await MaritimoRepository.getUltimasPosicionesNaves();
      const geoJsonMaritimo = this._crearGeoJSON(navesActivas, 'MARITIMA');

      if (socket) {
        socket.emit('geo-capa-maritima-init', geoJsonMaritimo);
      } else if (this.io) {
        this.io.to('sala-mapa-maritimo').emit('geo-capa-maritima-init', geoJsonMaritimo);
        this.io.to('sala-mapa-general').emit('geo-capa-maritima-init', geoJsonMaritimo);
      }

    } catch (error) {
      console.error('❌ [Geo Service] Error emitiendo capa marítima inicial:', error.message);
    }
  }

  // ================================================================
  // ⚡ ACTUALIZACIONES EN TIEMPO REAL (Llamadas por otros servicios)
  // ================================================================
  notificarMovimientoMaritimo(dtoNave) {
    if (!this.io) return;

    const featureUpdate = this._crearGeoJSON([dtoNave], 'MARITIMA').features[0];

    this.io.to('sala-mapa-maritimo').emit('geo-update-maritimo', featureUpdate);
    this.io.to('sala-mapa-general').emit('geo-update-maritimo', featureUpdate);
  }

  notificarIdentidadMaritima(datosIdentidad) {
    if (!this.io) return;
    this.io.to('sala-mapa-maritimo').emit('geo-identidad-maritima', datosIdentidad);
    this.io.to('sala-mapa-general').emit('geo-identidad-maritima', datosIdentidad);
  }

  // ================================================================
  // 🚪 GESTIÓN DE SALAS DE SOCKET.IO
  // ================================================================

  _configurarEventosSocket() {
    this.io.on('connection', (socket) => {

      // --- SALA MARÍTIMA ---
      socket.on('unirse-mapa-maritimo', async () => {
        try {
          // 🟢 CORRECCIÓN: ¡Metemos al cliente a la sala para que reciba actualizaciones futuras!
          socket.join('sala-mapa-maritimo');
          console.log(`⚓ Cliente ${socket.id} unido a [sala-mapa-maritimo]`);

          // Llamamos a la función que usa la unión de tablas
          const datos = await motonavesRepository.obtenerPosicionesConDimar();

          // 🟢 CORRECCIÓN: Usamos el método correcto de la clase y no la función inexistente
          const geoJson = this._crearGeoJSON(datos, 'MARITIMA');

          socket.emit('geo-capa-maritima-init', geoJson);
        } catch (error) {
          console.error("❌ Error al emitir capa marítima:", error);
        }
      });

      socket.on('salir-mapa-maritimo', () => {
        socket.leave('sala-mapa-maritimo');
        console.log(`📡 Cliente ${socket.id} abandonó [sala-mapa-maritimo]`);
      });

      // --- SALA GENERAL (DASHBOARD MASTER) ---
      socket.on('unirse-mapa-general', () => {
        socket.join('sala-mapa-general');
        this.emitirCapaMaritimaInicial(socket);
      });

      socket.on('salir-mapa-general', () => {
        socket.leave('sala-mapa-general');
      });

      socket.on('disconnect', () => {
        // Limpieza automática gestionada por Socket.IO
      });
    });
  }

  async obtenerCapaMaritimaGeoJSON() {
    try {
      const navesActivas = await MaritimoRepository.getUltimasPosicionesNaves();
      return this._crearGeoJSON(navesActivas, 'MARITIMA');
    } catch (error) {
      console.error('❌ [Geo Service] Error obteniendo capa marítima por REST:', error.message);
      throw error;
    }
  }

  async obtenerCapaInfraestructuraGeoJSON() {
    // ... (El código de infraestructura se mantiene igual)
  }
}

module.exports = new GeoreferenciacionService();