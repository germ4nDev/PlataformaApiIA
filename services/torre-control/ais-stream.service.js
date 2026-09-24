
// /*
//     Author: German Valencia
//     Pattern: PORTTOS Service
//     Descripción: Motor de Ingesta Satelital en Tiempo Real (AIS)
// */
// const WebSocket = require('ws');
// const MaritimoRepository = require('../../repositories/torre-control/maritimo.repository');

// class AISStreamService {

//     constructor() {
//         this.ws = null;
//         this.io = null;
//         this.mmsiRastreados = new Set();
//         this.geocercasActivas = [];

//         this.MODO_PRUEBA_GLOBAL = false;
//     }

//     // ================================================================
//     // 1. INICIALIZACIÓN (Llamado desde index.js)
//     // ================================================================
//     async iniciarConexion(io) {
//         this.io = io;
//         await this.cargarParametrosRadar();
//         this.conectarWebSocket();
//     }

//     async cargarParametrosRadar() {
//         try {
//             const puertos = await MaritimoRepository.getPuertosParaMapa();

//             this.geocercasActivas = puertos.map(p => [
//                 [parseFloat(p.bbox_lat_sur), parseFloat(p.bbox_lon_oeste)],
//                 [parseFloat(p.bbox_lat_norte), parseFloat(p.bbox_lon_este)]
//             ]);

//             const motonaves = await MaritimoRepository.getMotonavesAvisadasParaRastreo();
//             this.mmsiRastreados = new Set(motonaves.map(m => String(m.mmsi)));
//         } catch (error) {
//             console.error('❌ [AIS Engine] Error cargando parámetros de la BD:', error.message);
//         }
//     }

//     async recargarListaBlanca() {
//         try {
//             const motonaves = await MaritimoRepository.getMotonavesAvisadasParaRastreo();
//             this.mmsiRastreados = new Set(motonaves.map(m => String(m.mmsi)));

//             if (this.ws && this.ws.readyState === WebSocket.OPEN) {
//                 this.enviarSuscripcion();
//             }
//         } catch (error) {
//             console.error('❌ [AIS Engine] Error recargando lista blanca:', error.message);
//         }
//     }

//     async _procesarYPersistirAIS(aisMessage) {
//         try {
//             // 1. PROCESAR POSICIÓN (Latitud/Longitud)
//             if (aisMessage.MessageType === 'PositionReport') {
//                 const reporte = aisMessage.Message.PositionReport;
//                 const mmsi = String(reporte.UserID);

//                 // 🛡️ Doble validación del Escudo Activo
//                 if (!this.MODO_PRUEBA_GLOBAL && !this.mmsiRastreados.has(mmsi)) return;

//                 const dataDTO = {
//                     mmsi: mmsi,
//                     lat: reporte.Latitude,
//                     lon: reporte.Longitude,
//                     velocidad: reporte.Sog,
//                     rumbo: reporte.Cog,
//                     estadoInferido: reporte.Sog < 0.5 ? 'DETENIDO' : 'EN MOVIMIENTO',
//                     nombre_motonave: null,
//                     destino: null
//                 };

//                 await MaritimoRepository.guardarUltimaPosicionAIS(dataDTO);
//             }

//             // 2. PROCESAR DATOS ESTÁTICOS (Nombre/Destino)
//             else if (aisMessage.MessageType === 'ShipStaticData') {
//                 const staticData = aisMessage.Message.ShipStaticData;
//                 const mmsi = String(staticData.UserID);

//                 // Solo nos importa si es un barco que ya tenemos en lista blanca
//                 if (!this.MODO_PRUEBA_GLOBAL && !this.mmsiRastreados.has(mmsi)) return;

//                 // console.log(`🏷️ [AIS Static] MMSI: ${mmsi} | Nombre: ${staticData.Name} | Destino: ${staticData.Destination}`);

//                 const staticDTO = {
//                     mmsi: mmsi,
//                     lat: null, // No actualizamos posición aquí
//                     lon: null,
//                     velocidad: null,
//                     rumbo: null,
//                     estadoInferido: null,
//                     nombre_motonave: staticData.Name ? staticData.Name.trim() : null,
//                     destino: staticData.Destination ? staticData.Destination.trim() : null
//                 };

//                 // Reutilizamos el mismo método del repositorio.
//                 // Gracias al COALESCE en tu SQL, si latitud/longitud vienen NULL, 
//                 // el MERGE los ignorará y solo actualizará el nombre y destino.
//                 await MaritimoRepository.guardarUltimaPosicionAIS(staticDTO);
//             }

//         } catch (error) {
//             console.error(`⚠️ [AIS Engine] Falla al persistir trama AIS:`, error.message);
//         }
//     }

//     // ================================================================
//     // 3. FASE DE PROCESAMIENTO Y PERSISTENCIA
//     // ================================================================
//     enviarSuscripcion() {
//         let boundingBoxes, mmsiFilters;

//         if (this.MODO_PRUEBA_GLOBAL) {
//             boundingBoxes = [[[-4.0, -84.0], [15.0, -66.0]]];
//             mmsiFilters = [];
//         } else {
//             boundingBoxes = this.geocercasActivas.length > 0 ? this.geocercasActivas : [[[-90, -180], [90, 180]]];
//             mmsiFilters = Array.from(this.mmsiRastreados);
//         }

//         const subscriptionMessage = {
//             Apikey: process.env.AIS_API_KEY,
//             BoundingBoxes: boundingBoxes,
//             FiltersShipMMSI: mmsiFilters,
//             // 🔥 LA CORRECCIÓN: Pedimos ambas tramas
//             FilterMessageTypes: ["PositionReport", "ShipStaticData"]
//         };

//         this.ws.send(JSON.stringify(subscriptionMessage));
//     }

//     // ================================================================
//     // 2. TÚNEL WEBSOCKET (Conexión Satelital)
//     // ================================================================
//     conectarWebSocket() {
//         if (!process.env.AIS_API_KEY) {
//             return;
//         }

//         // this.ws = new WebSocket("wss://stream.aisstream.io/v0/stream");

//         // this.ws.on("open", () => {
//         //     // this.enviarSuscripcion();
//         // });

//         // this.ws.on("message", async (data) => {
//         //     try {
//         //         const aisMessage = JSON.parse(data);
//         //         await this._procesarYPersistirAIS(aisMessage);
//         //     } catch (err) {
//         //         // Se ignoran tramas rotas o JSON inválidos silenciosamente
//         //     }
//         // });

//         // this.ws.on("error", (err) => {
//         //     console.error("❌ [AIS Engine] Error en el túnel satelital:", err.message);
//         // });

//         // this.ws.on("close", () => {
//         //     setTimeout(() => this.conectarWebSocket(), 5000);
//         // });
//     }
// }

// // Exportamos un Singleton para que index.js y SitmarEtlService compartan la misma instancia en memoria
// module.exports = new AISStreamService();

/*
    Author: German Valencia
    Pattern: PORTTOS Service
    Descripción: Motor de Ingesta Satelital en Tiempo Real (AIS) con Retroceso Exponencial
*/
const WebSocket = require('ws');
const MaritimoRepository = require('../../repositories/torre-control/maritimo.repository');

class AISStreamService {
    constructor() {
        this.ws = null;
        this.io = null;
        this.mmsiRastreados = new Set();
        this.geocercasActivas = [];
        this.MODO_PRUEBA_GLOBAL = false;

        // --- LÓGICA DE RETROCESO EXPONENCIAL ---
        this.intentosReconexion = 0;
        this.retrasoBase = 5000;    // 5 segundos
        this.retrasoMaximo = 60000; // Tope máximo: 60 segundos
    }

    async iniciarConexion(io) {
        this.io = io;
        await this.cargarParametrosRadar();
        this.conectarWebSocket();
    }

    async cargarParametrosRadar() {
        try {
            const puertos = await MaritimoRepository.getPuertosParaMapa();
            this.geocercasActivas = puertos.map(p => [
                [parseFloat(p.bbox_lat_sur), parseFloat(p.bbox_lon_oeste)],
                [parseFloat(p.bbox_lat_norte), parseFloat(p.bbox_lon_este)]
            ]);

            const motonaves = await MaritimoRepository.getMotonavesAvisadasParaRastreo();
            this.mmsiRastreados = new Set(motonaves.map(m => String(m.mmsi)));
        } catch (error) {
            console.error('❌ [AIS Engine] Error cargando parámetros de la BD:', error.message);
        }
    }

    async recargarListaBlanca() {
        try {
            const motonaves = await MaritimoRepository.getMotonavesAvisadasParaRastreo();
            this.mmsiRastreados = new Set(motonaves.map(m => String(m.mmsi)));

            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.enviarSuscripcion();
            }
        } catch (error) {
            console.error('❌ [AIS Engine] Error recargando lista blanca:', error.message);
        }
    }

    async _procesarYPersistirAIS(aisMessage) {
        try {
            if (aisMessage.MessageType === 'PositionReport') {
                const reporte = aisMessage.Message.PositionReport;
                const mmsi = String(reporte.UserID);

                if (!this.MODO_PRUEBA_GLOBAL && !this.mmsiRastreados.has(mmsi)) return;

                const dataDTO = {
                    mmsi: mmsi,
                    lat: reporte.Latitude,
                    lon: reporte.Longitude,
                    velocidad: reporte.Sog,
                    rumbo: reporte.Cog,
                    estadoInferido: reporte.Sog < 0.5 ? 'DETENIDO' : 'EN MOVIMIENTO',
                    nombre_motonave: null,
                    destino: null
                };

                await MaritimoRepository.guardarUltimaPosicionAIS(dataDTO);

                const featureSocket = {
                    type: "Feature",
                    geometry: { type: "Point", coordinates: [reporte.Longitude, reporte.Latitude] },
                    properties: {
                        mmsi: mmsi,
                        nombre_motonave: 'DESCONOCIDO', // Se actualizará cuando llegue la trama estática
                        velocidad: reporte.Sog,
                        rumbo: reporte.Cog,
                        timestamp: new Date().toISOString(),
                        estado_nave: 'EN TRÁNSITO'
                    }
                };

                if (this.io) {
                    this.io.emit('radar-actualizado', featureSocket);
                }

                // NOTA: Si vas a usar ESTE servicio como el principal, deberías 
                // emitir el evento de Socket.io hacia Angular aquí mismo.
            } else if (aisMessage.MessageType === 'ShipStaticData') {
                const staticData = aisMessage.Message.ShipStaticData;
                const mmsi = String(staticData.UserID);

                if (!this.MODO_PRUEBA_GLOBAL && !this.mmsiRastreados.has(mmsi)) return;

                const staticDTO = {
                    mmsi: mmsi,
                    lat: null,
                    lon: null,
                    velocidad: null,
                    rumbo: null,
                    estadoInferido: null,
                    nombre_motonave: staticData.Name ? staticData.Name.trim() : null,
                    destino: staticData.Destination ? staticData.Destination.trim() : null
                };

                await MaritimoRepository.guardarUltimaPosicionAIS(staticDTO);
            }
        } catch (error) {
            console.error(`⚠️ [AIS Engine] Falla al persistir trama AIS:`, error.message);
        }
    }

    enviarSuscripcion() {
        let boundingBoxes, mmsiFilters;

        if (this.MODO_PRUEBA_GLOBAL) {
            boundingBoxes = [[[-4.0, -84.0], [15.0, -66.0]]];
            mmsiFilters = [];
        } else {
            boundingBoxes = this.geocercasActivas.length > 0 ? this.geocercasActivas : [[[-90, -180], [90, 180]]];
            mmsiFilters = Array.from(this.mmsiRastreados);
        }

        const subscriptionMessage = {
            Apikey: process.env.AIS_API_KEY,
            BoundingBoxes: boundingBoxes,
            FiltersShipMMSI: mmsiFilters,
            FilterMessageTypes: ["PositionReport", "ShipStaticData"]
        };

        this.ws.send(JSON.stringify(subscriptionMessage));
    }

    conectarWebSocket() {
        if (!process.env.AIS_API_KEY) {
            console.warn("⚠️ [AIS Engine] No se encontró AIS_API_KEY.");
            return;
        }

        console.log(`📡 [AIS Engine] Conectando a AisStream (Intento #${this.intentosReconexion + 1})...`);
        this.ws = new WebSocket("wss://stream.aisstream.io/v0/stream");

        this.ws.on("open", () => {
            console.log("✅ [AIS Engine] Conexión establecida con éxito.");
            this.intentosReconexion = 0; // RESETEAR CASTIGO
            this.enviarSuscripcion();
        });

        this.ws.on("message", async (data) => {
            try {
                const aisMessage = JSON.parse(data);
                await this._procesarYPersistirAIS(aisMessage);
            } catch (err) {
                // Se ignoran tramas rotas
            }
        });

        this.ws.on("error", (err) => {
            console.error("❌ [AIS Engine] Error en el túnel satelital:", err.message);
        });

        this.ws.on("close", () => {
            this.manejarReconexion();
        });
    }

    manejarReconexion() {
        let retrasoCalculado = this.retrasoBase * Math.pow(2, this.intentosReconexion);
        if (retrasoCalculado > this.retrasoMaximo) retrasoCalculado = this.retrasoMaximo;

        console.log(`⚠️ [AIS Engine] Conexión cerrada. Reconectando en ${retrasoCalculado / 1000} segundos...`);

        setTimeout(() => {
            this.intentosReconexion++;
            this.conectarWebSocket();
        }, retrasoCalculado);
    }
}

module.exports = new AISStreamService();