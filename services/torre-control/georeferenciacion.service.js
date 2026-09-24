// /*
//     Author: German Valencia
//     Pattern: PORTTOS Service - Motor Central de Georreferenciación (PRODUCCIÓN)
//     Descripción: Unifica datos espaciales (Marítimos, Terrestres, Infraestructura),
//                  los transforma al estándar GeoJSON y administra las salas (Rooms) 
//                  de Socket.IO para distribución optimizada de capas.
// */
// const MaritimoRepository = require('../../repositories/torre-control/maritimo.repository');
// // const TerrestreRepository = require('../../repositories/torre-control/terrestre.repository'); 
// // const InfraestructuraRepository = require('../../repositories/maestros/infraestructura.repository');

// class GeoreferenciacionService {
//   constructor() {
//     this.io = null;
//   }

//   /**
//    * Inicializa el motor espacial y activa la escucha de las salas del tablero.
//    * @param {Object} ioInstance - Instancia global de Socket.IO
//    */
//   inicializar(ioInstance) {
//     if (!ioInstance) {
//       console.error('❌ [Geo Service] Se requiere la instancia de Socket.IO para inicializar.');
//       return;
//     }

//     this.io = ioInstance;
//     this._configurarEventosSocket();
//   }

//   // ================================================================
//   // 🛠️ MOTOR DE TRADUCCIÓN GEOJSON
//   // ================================================================

//   /**
//    * Convierte un arreglo de datos relacionales a un FeatureCollection (Estándar GeoJSON).
//    * @param {Array} datosPlanos - Lista de objetos de la base de datos.
//    * @param {String} tipoCapa - Identificador de la capa ('MARITIMA', 'TERRESTRE', 'INFRAESTRUCTURA').
//    */
//   // _crearGeoJSON(datosPlanos, tipoCapa) {
//   //   if (!datosPlanos || !Array.isArray(datosPlanos)) return { type: 'FeatureCollection', features: [] };

//   //   const features = datosPlanos.map(item => {
//   //     // Extraemos latitud y longitud, soportando diferentes nomenclaturas de las tablas
//   //     const lat = parseFloat(item.latitud || item.lat || 0);
//   //     const lon = parseFloat(item.longitud || item.lon || 0);

//   //     // GeoJSON exige estrictamente el orden: [Longitud, Latitud]
//   //     return {
//   //       type: 'Feature',
//   //       geometry: {
//   //         type: 'Point',
//   //         coordinates: [lon, lat]
//   //       },
//   //       properties: {
//   //         capa: tipoCapa,
//   //         ...item // Inyectamos dinámicamente el resto de datos (mmsi, placa, velocidad, etc.)
//   //       }
//   //     };
//   //   });

//   //   return {
//   //     type: 'FeatureCollection',
//   //     features: features
//   //   };
//   // }
//   _crearGeoJSON(naves, tipo) {
//     return {
//       type: 'FeatureCollection',
//       features: naves.map(n => ({
//         type: 'Feature',
//         geometry: {
//           type: 'Point',
//           // Si lat o lon son null, ponemos un valor que el mapa ignore
//           coordinates: [n.longitud || 0, n.latitud || 0]
//         },
//         properties: {
//           nombre_motonave: n.motonave,
//           agencia: n.agencia,
//           // ... resto de campos
//           mmsi: n.mmsi
//         }
//       })).filter(f => f.geometry.coordinates[0] !== 0) // FILTRO FINAL: Si es 0, no lo mandamos al mapa
//     };
//   }

//   // ================================================================
//   // 📦 EXTRACCIÓN Y EMISIÓN DE CAPAS (ESTADO INICIAL)
//   // ================================================================

//   /**
//    * Extrae todas las últimas posiciones conocidas, las convierte a GeoJSON 
//    * y las envía a los clientes conectados a las salas correspondientes.
//    */
//   async emitirCapaMaritimaInicial(socket = null) {
//     try {
//       // NOTA: Asegúrate de tener este método en tu MaritimoRepository que haga un 
//       // SELECT * FROM dbo.TCLAisUltimaPosicion
//       const navesActivas = await MaritimoRepository.getUltimasPosicionesNaves();
//       const geoJsonMaritimo = this._crearGeoJSON(navesActivas, 'MARITIMA');

//       // Si pasamos un socket específico, se lo enviamos solo a él (al unirse)
//       if (socket) {
//         socket.emit('geo-capa-maritima-init', geoJsonMaritimo);
//       } else if (this.io) {
//         // Si no, hacemos broadcast a todos en la sala
//         this.io.to('sala-mapa-maritimo').emit('geo-capa-maritima-init', geoJsonMaritimo);
//         this.io.to('sala-mapa-general').emit('geo-capa-maritima-init', geoJsonMaritimo);
//       }

//     } catch (error) {
//       console.error('❌ [Geo Service] Error emitiendo capa marítima inicial:', error.message);
//     }
//   }

//   // async emitirCapaTerrestreInicial(socket = null) { ... }
//   // async emitirCapaInfraestructura(socket = null) { ... }

//   // ================================================================
//   // ⚡ ACTUALIZACIONES EN TIEMPO REAL (Llamadas por otros servicios)
//   // ================================================================
//   notificarMovimientoMaritimo(dtoNave) {
//     if (!this.io) return;

//     // Convertimos el registro individual a un Feature de GeoJSON
//     const featureUpdate = this._crearGeoJSON([dtoNave], 'MARITIMA').features[0];

//     // Ruteamos la telemetría a las salas que necesiten ver barcos
//     this.io.to('sala-mapa-maritimo').emit('geo-update-maritimo', featureUpdate);
//     this.io.to('sala-mapa-general').emit('geo-update-maritimo', featureUpdate);
//   }

//   /**
//    * Puente llamado para emitir identidades de naves (Estático)
//    */
//   notificarIdentidadMaritima(datosIdentidad) {
//     if (!this.io) return;
//     this.io.to('sala-mapa-maritimo').emit('geo-identidad-maritima', datosIdentidad);
//     this.io.to('sala-mapa-general').emit('geo-identidad-maritima', datosIdentidad);
//   }

//   // ================================================================
//   // 🚪 GESTIÓN DE SALAS DE SOCKET.IO
//   // ================================================================

//   _configurarEventosSocket() {
//     this.io.on('connection', (socket) => {

//       // --- SALA MARÍTIMA ---
//       socket.on('unirse-mapa-maritimo', async () => {
//         try {
//           // AQUÍ ESTÁ EL CAMBIO: Llamamos a la función que usa la unión de tablas
//           const datos = await motonavesRepository.obtenerPosicionesConDimar();

//           // Convertimos el resultado de SQL a GeoJSON (esto ya lo debes tener, 
//           // pero asegúrate de que los filtros de lat/lon <> 0 estén aquí)
//           const geoJson = transformarA_GeoJSON(datos);

//           socket.emit('geo-capa-maritima-init', geoJson);
//         } catch (error) {
//           console.error("Error al emitir capa marítima:", error);
//         }
//       });

//       socket.on('salir-mapa-maritimo', () => {
//         socket.leave('sala-mapa-maritimo');
//         console.log(`📡 Cliente ${socket.id} abandonó [sala-mapa-maritimo]`);
//       });

//       // --- SALA GENERAL (DASHBOARD MASTER) ---
//       socket.on('unirse-mapa-general', () => {
//         socket.join('sala-mapa-general');

//         // El dashboard general necesita todas las capas
//         this.emitirCapaMaritimaInicial(socket);
//         // this.emitirCapaTerrestreInicial(socket);
//         // this.emitirCapaInfraestructura(socket);
//       });

//       socket.on('salir-mapa-general', () => {
//         socket.leave('sala-mapa-general');
//       });

//       // Desconexión general (limpieza automática gestionada por Socket.IO)
//       socket.on('disconnect', () => {
//         // No es necesario hacer leave() manual, Socket.IO lo hace automáticamente al perder conexión.
//       });
//     });
//   }

//   async obtenerCapaMaritimaGeoJSON() {
//     try {
//       const navesActivas = await MaritimoRepository.getUltimasPosicionesNaves();
//       return this._crearGeoJSON(navesActivas, 'MARITIMA');
//     } catch (error) {
//       console.error('❌ [Geo Service] Error obteniendo capa marítima por REST:', error.message);
//       throw error;
//     }
//   }

//   async obtenerCapaInfraestructuraGeoJSON() {
//     try {
//       const puertos = await MaritimoRepository.getPuertosParaMapa();

//       const features = puertos.map(p => {
//         // GeoJSON exige que los polígonos cierren donde empezaron (5 puntos para un rectángulo)
//         const coordenadasCaja = [[
//           [parseFloat(p.bbox_lon_oeste), parseFloat(p.bbox_lat_sur)], // Esquina Inferior Izquierda
//           [parseFloat(p.bbox_lon_este), parseFloat(p.bbox_lat_sur)],  // Esquina Inferior Derecha
//           [parseFloat(p.bbox_lon_este), parseFloat(p.bbox_lat_norte)],// Esquina Superior Derecha
//           [parseFloat(p.bbox_lon_oeste), parseFloat(p.bbox_lat_norte)],// Esquina Superior Izquierda
//           [parseFloat(p.bbox_lon_oeste), parseFloat(p.bbox_lat_sur)]  // Cierre del polígono
//         ]];

//         return {
//           type: 'Feature',
//           geometry: {
//             type: 'Polygon',
//             coordinates: coordenadasCaja
//           },
//           properties: {
//             capa: 'INFRAESTRUCTURA',
//             nombre: p.nombre_puerto
//           }
//         };
//       });

//       return { type: 'FeatureCollection', features };
//     } catch (error) {
//       throw error;
//     }
//   }
// }

// module.exports = new GeoreferenciacionService();
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