const WebSocket = require('ws');
const db = require('../../models');
const { getIO } = require('../helpers/socket.helper');

const BBOX_PUERTOS = {
  'BUENAVENTURA': [-2.0000, -84.0000, 8.0000, -77.0000],
  'CARTAGENA': [10.25, -75.65, 10.45, -75.45],
  'SANTAMARTA': [11.15, -74.30, 11.35, -74.10],
  'BARRANQUILLA': [10.95, -74.90, 11.15, -74.70]
};

class AisRadarManager {
  constructor() {
    this.socket = null;
    this.apiKey = process.env.AIS_API_KEY;
    this.currentPuerto = null;
    this.ioInstance = null;

    // --- LÓGICA DE RETROCESO EXPONENCIAL ---
    this.intentosReconexion = 0;
    this.retrasoBase = 5000;    // 5 segundos
    this.retrasoMaximo = 60000; // Tope máximo: 60 segundos
  }

  cambiarPuerto(puertoId, io = null) {
    if (io) this.ioInstance = io;
    const bbox = BBOX_PUERTOS[puertoId];
    if (!bbox) {
      throw new Error(`El puerto '${puertoId}' no tiene un BBOX configurado.`);
    }

    if (this.socket) {
      console.log(`🔄 [Radar Manager] Cerrando conexión anterior del radar...`);
      this.socket.terminate();
      this.socket = null;
    }

    this.currentPuerto = puertoId;
    console.log(`📡 [Radar Manager] Abriendo radar para el puerto: ${puertoId.toUpperCase()}`);

    this.conectarSocket([bbox]);
  }

  iniciarRadarGlobal(io = null) {
    if (io) this.ioInstance = io;
    console.log(`📡 [Radar Manager] Abriendo radar global para TODOS los puertos...`);
    this.currentPuerto = 'GLOBAL';

    const todosLosBbox = Object.values(BBOX_PUERTOS).map(box => [
      [box[0], box[1]],
      [box[2], box[3]]
    ]);

    this.conectarSocket(todosLosBbox);
  }

  conectarSocket(boundingBoxesArray) {
    console.log(`🔍 [Radar Manager] Intentando conectar WebSocket (Intento #${this.intentosReconexion + 1})`);

    this.socket = new WebSocket("wss://stream.aisstream.io/v0/stream");

    this.socket.onopen = () => {
      console.log(`✅ [Radar Manager] Conexión exitosa. Suscribiendo al radar multizona...`);
      this.intentosReconexion = 0; // RESETEAR CASTIGO

      const barcosPruebaBuenaventura = [
        { mmsi: '730000001', nombre: 'BUENAVENTURA EXPRESS', latitud: 3.8476, longitud: -77.1297, velocidad: 0.0, rumbo: 0, estado_inferido: 'FONDEADO', timestamp: new Date().toISOString() },
        { mmsi: '730000002', nombre: 'PACIFIC TRADER', latitud: 3.8776, longitud: -77.0797, velocidad: 2.5, rumbo: 120, estado_inferido: 'NAVEGANDO', timestamp: new Date().toISOString() }
      ];

      for (const barco of barcosPruebaBuenaventura) {
        this.guardarOActualizarPosicionEnDB(barco);
      }

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

        const datosNave = {
          mmsi: metadatos.MMSI,
          nombre: metadatos.ShipName ? metadatos.ShipName.trim() : 'DESCONOCIDO',
          latitud: reporte.Latitude,
          longitud: reporte.Longitude,
          velocidad: reporte.Sog,
          rumbo: reporte.Cog,
          timestamp: metadatos.time_utc
        };

        this.guardarOActualizarPosicionEnDB(datosNave);

        const featureSocket = {
          type: "Feature",
          geometry: { type: "Point", coordinates: [datosNave.longitud, datosNave.latitud] },
          properties: { mmsi: datosNave.mmsi, nombre_motonave: datosNave.nombre, velocidad: datosNave.velocidad, rumbo: datosNave.rumbo, timestamp: datosNave.timestamp, estado_nave: 'EN TRÁNSITO' }
        };

        if (this.ioInstance) {
          this.ioInstance.emit('radar-actualizado', featureSocket);
        }
      }
    };

    this.socket.onerror = (error) => {
      console.error(`❌ [Radar Manager] Error en WebSocket:`, error.message);
    };

    this.socket.onclose = () => {
      this.manejarReconexion();
    };
  }

  manejarReconexion() {
    let retrasoCalculado = this.retrasoBase * Math.pow(2, this.intentosReconexion);
    if (retrasoCalculado > this.retrasoMaximo) retrasoCalculado = this.retrasoMaximo;

    console.log(`⚠️ [Radar Manager] Conexión cerrada. Reconectando en ${retrasoCalculado / 1000} segundos...`);

    setTimeout(() => {
      this.intentosReconexion++;
      if (this.currentPuerto === 'GLOBAL') {
        this.iniciarRadarGlobal(this.ioInstance);
      } else if (this.currentPuerto) {
        this.cambiarPuerto(this.currentPuerto, this.ioInstance);
      }
    }, retrasoCalculado);
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
        fechaCreacion: new Date().toISOString(),
        codigoUsuarioModificacion: 'ADMIN_SYSTEM',
        fechaModificacion: new Date().toISOString()
      });
    } catch (error) {
      console.error(`❌ Error al guardar en DB:`, error.message);
    }
  }
}

module.exports = new AisRadarManager();