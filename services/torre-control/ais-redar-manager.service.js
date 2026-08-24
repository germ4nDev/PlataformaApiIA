// module.exports = new AisRadarManager();
const WebSocket = require('ws');
const db = require('../../models');

const BBOX_PUERTOS = {
  'BUENAVENTURA': [-2.0000, -84.0000, 8.0000, -77.0000],
  'CARTAGENA': [10.25, -75.65, 10.45, -75.45],
  'SANTAMARTA': [11.15, -74.30, 11.35, -74.10],
  'BARRANQUILLA': [10.95, -74.90, 11.15, -74.70]
};

// const BBOX_PUERTOS = {
//   'BUENAVENTURA': [-2.0000, -84.0000, 8.0000, -77.0000]
// };

class AisRadarManager {
  constructor() {
    this.socket = null;
    this.apiKey = process.env.AIS_API_KEY;
    this.currentPuerto = null;
    this.ioInstance = null;
  }

  cambiarPuerto(puertoId, io = null) {
    if (io) this.ioInstance = io;
    const bbox = BBOX_PUERTOS[puertoId];
    if (!bbox) {
      throw new Error(`El puerto '${puertoId}' no tiene un BBOX configurado.`);
    }

    if (this.socket) {
      console.log(`🔄 Cerrando conexión anterior del radar...`);
      this.socket.terminate();
      this.socket = null;
    }

    this.currentPuerto = puertoId;
    console.log(`📡 Abriendo radar de Aisstream para el puerto: ${puertoId.toUpperCase()}`);

    this.conectarSocket([bbox]);
  }

  // 🌎 Súper Radar (Vigilar todos los puertos simultáneamente y emitir al frontend)
  iniciarRadarGlobal(io = null) {
    if (io) this.ioInstance = io;
    console.log(`📡 Abriendo radar global de Aisstream para TODOS los puertos de Colombia...`);
    this.currentPuerto = 'GLOBAL';

    // Extraemos todos los BBOX y los convertimos al formato anidado [ [latMin, lonMin], [latMax, lonMax] ]
    const todosLosBbox = Object.values(BBOX_PUERTOS).map(box => [
      [box[0], box[1]],
      [box[2], box[3]]
    ]);

    this.conectarSocket(todosLosBbox);
  }

  // conectarSocket(boundingBoxesArray) {
  //   this.socket = new WebSocket("wss://stream.aisstream.io/v0/stream");

  //   this.socket.onopen = () => {
  //     console.log(`✅ Conexión WebSocket exitosa. Suscribiendo al radar multizona...`);
  //     const subscriptionMessage = {
  //       APIKey: this.apiKey,
  //       BoundingBoxes: boundingBoxesArray,
  //       FilterMessageTypes: ["PositionReport"]
  //     };
  //     this.socket.send(JSON.stringify(subscriptionMessage));
  //   };

  //   this.socket.onmessage = (event) => {
  //     const aisMessage = JSON.parse(event.data);

  //     if (aisMessage.MessageType === "PositionReport") {
  //       const reporte = aisMessage.Message.PositionReport;
  //       const metadatos = aisMessage.MetaData;

  //       const datosNave = {
  //         mmsi: metadatos.MMSI,
  //         nombre: metadatos.ShipName ? metadatos.ShipName.trim() : 'DESCONOCIDO',
  //         latitud: reporte.Latitude,
  //         longitud: reporte.Longitude,
  //         velocidad: reporte.Sog,
  //         rumbo: reporte.Cog,
  //         timestamp: metadatos.time_utc
  //       };

  //       const barcosPruebaBuenaventura = [
  //         {
  //           mmsi: '730000001', // MMSI de prueba
  //           nombre_motonave: 'BUENAVENTURA EXPRESS',
  //           latitud: 3.8881,
  //           longitud: -77.0643, // Exactamente en la zona de muelles
  //           velocidad: 0.0,
  //           rumbo: 0,
  //           estado_inferido: 'FONDEADO',
  //           // Corrección aplicada: aseguramos el formato ISO para evitar el error de esquema
  //           fecha_creacion: new Date().toISOString()
  //         },
  //         {
  //           mmsi: '730000002',
  //           nombre_motonave: 'PACIFIC TRADER',
  //           latitud: 3.8950,
  //           longitud: -77.0800, // Zona de fondeo / entrada a la bahía
  //           velocidad: 2.5,
  //           rumbo: 120,
  //           estado_inferido: 'NAVEGANDO',
  //           fecha_creacion: new Date().toISOString()
  //         }
  //       ];

  //       // for (const barco of barcosPruebaBuenaventura) {
  //       //   this.guardarOActualizarPosicionEnDB(barco);
  //       // }
  //       datosNave.push(barcosPruebaBuenaventura)

  //       this.guardarOActualizarPosicionEnDB(datosNave);

  //       const featureSocket = {
  //         type: "Feature",
  //         geometry: {
  //           type: "Point",
  //           coordinates: [datosNave.longitud, datosNave.latitud]
  //         },
  //         properties: {
  //           mmsi: datosNave.mmsi,
  //           nombre_motonave: datosNave.nombre,
  //           velocidad: datosNave.velocidad,
  //           rumbo: datosNave.rumbo,
  //           timestamp: datosNave.timestamp,
  //           estado_nave: 'EN TRÁNSITO'
  //         }
  //       };

  //       if (this.ioInstance) {
  //         this.ioInstance.emit('radar-actualizado', featureSocket);
  //       }
  //     }
  //   };

  //   this.socket.onerror = (error) => {
  //     console.error(`❌ Error en el WebSocket de Aisstream:`, error.message);
  //   };

  //   this.socket.onclose = () => {
  //     console.log(`⚠️ Conexión WebSocket cerrada. Intentando reconectar en 5 segundos...`);
  //     setTimeout(() => {
  //       if (this.currentPuerto === 'GLOBAL') {
  //         this.iniciarRadarGlobal(this.ioInstance);
  //       } else if (this.currentPuerto) {
  //         this.cambiarPuerto(this.currentPuerto, this.ioInstance);
  //       }
  //     }, 5000);
  //   };
  // }
  conectarSocket(boundingBoxesArray) {
    this.socket = new WebSocket("wss://stream.aisstream.io/v0/stream");

    this.socket.onopen = () => {
      console.log(`✅ Conexión WebSocket exitosa. Suscribiendo al radar multizona...`);

      // 1. INYECCIÓN DE DATOS SEMILLA (Se ejecuta UNA SOLA VEZ)
      const barcosPruebaBuenaventura = [
        {
          mmsi: '730000001',
          nombre: 'BUENAVENTURA EXPRESS',
          // En el agua, en la bahía interna (zona de fondeo segura)
          latitud: 3.8476,
          longitud: -77.1297,
          velocidad: 0.0,
          rumbo: 0,
          estado_inferido: 'FONDEADO',
          timestamp: new Date().toISOString()
        },
        {
          mmsi: '730000002',
          nombre: 'PACIFIC TRADER',
          // Más al occidente, mar adentro en el canal de acceso
          latitud: 3.8776,
          longitud: -77.0797,
          velocidad: 2.5,
          rumbo: 120,
          estado_inferido: 'NAVEGANDO',
          timestamp: new Date().toISOString()
        }
      ];

      // Guardamos los barcos de prueba en la BD
      for (const barco of barcosPruebaBuenaventura) {
        console.log(`⚓ Datos de barco seed.`, barco);
        this.guardarOActualizarPosicionEnDB(barco);
      }
      console.log(`⚓ Datos semilla de Buenaventura inyectados en la BD.`);

      // 2. SUSCRIPCIÓN A AISSTREAM
      const subscriptionMessage = {
        APIKey: this.apiKey,
        BoundingBoxes: boundingBoxesArray,
        FilterMessageTypes: ["PositionReport"]
      };
      this.socket.send(JSON.stringify(subscriptionMessage));
    };

    this.socket.onmessage = (event) => {
      const aisMessage = JSON.parse(event.data);

      if (aisMessage.MessageType === "PositionReport") {
        const reporte = aisMessage.Message.PositionReport;
        const metadatos = aisMessage.MetaData;

        // 3. PROCESAMIENTO DE NAVES REALES
        const datosNave = {
          mmsi: metadatos.MMSI,
          nombre: metadatos.ShipName ? metadatos.ShipName.trim() : 'DESCONOCIDO',
          latitud: reporte.Latitude,
          longitud: reporte.Longitude,
          velocidad: reporte.Sog,
          rumbo: reporte.Cog,
          timestamp: metadatos.time_utc
        };

        // Guardamos solo el barco real que acaba de llegar
        this.guardarOActualizarPosicionEnDB(datosNave);

        const featureSocket = {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [datosNave.longitud, datosNave.latitud]
          },
          properties: {
            mmsi: datosNave.mmsi,
            nombre_motonave: datosNave.nombre,
            velocidad: datosNave.velocidad,
            rumbo: datosNave.rumbo,
            timestamp: datosNave.timestamp,
            estado_nave: 'EN TRÁNSITO'
          }
        };

        if (this.ioInstance) {
          this.ioInstance.emit('radar-actualizado', featureSocket);
        }
      }
    };

    this.socket.onerror = (error) => {
      console.error(`❌ Error en el WebSocket de Aisstream:`, error.message);
    };

    this.socket.onclose = () => {
      console.log(`⚠️ Conexión WebSocket cerrada. Intentando reconectar en 5 segundos...`);
      setTimeout(() => {
        if (this.currentPuerto === 'GLOBAL') {
          this.iniciarRadarGlobal(this.ioInstance);
        } else if (this.currentPuerto) {
          this.cambiarPuerto(this.currentPuerto, this.ioInstance);
        }
      }, 5000);
    };
  }

  async guardarOActualizarPosicionEnDB(datosNave) {
    try {
      await db.TCLAisUltimaPosicion.upsert({
        mmsi: datosNave.mmsi,
        nombre_motonave: datosNave.nombre,
        latitud: datosNave.latitud,
        longitud: datosNave.longitud,
        velocidad: datosNave.velocidad,
        rumbo: datosNave.rumbo,
        destino: '',
        estado_inferido: '',
        codigoUsuarioCreacion: 'ADMIN_SYSTEM',
        fechaCreacion: new Date().toISOString(), // 🛠️ Convertido a string plano
        codigoUsuarioModificacion: 'ADMIN_SYSTEM',
        fechaModificacion: new Date().toISOString() // 🛠️ Convertido a string plano
      });

      console.log(`💾 [DB] Posición actualizada para: ${datosNave.nombre} (MMSI: ${datosNave.mmsi})`);
    } catch (error) {
      console.error(`❌ Error al guardar en TCLAisUltimaPosicion:`, error.message);
    }
  }
}

// Exportamos una instancia única (Singleton)
module.exports = new AisRadarManager();