
/*
    Author: German Valencia
    Pattern: QPLUS Service
    Descripción: Motor de Ingesta Satelital en Tiempo Real (AIS)
*/
const WebSocket = require('ws');
const MaritimoRepository = require('../../repositories/torre-control/maritimo.repository');

class AISStreamService {

    constructor() {
        this.ws = null;
        this.io = null;
        this.mmsiRastreados = new Set();
        this.geocercasActivas = [];

        // 🚨 SWITCH DE PRUEBA: Cambia a 'true' para ignorar la lista blanca 
        // y capturar todo el tráfico de Colombia/Panamá (Prueba de Estrés).
        this.MODO_PRUEBA_GLOBAL = true;
    }

    // ================================================================
    // 1. INICIALIZACIÓN (Llamado desde index.js)
    // ================================================================
    async iniciarConexion(io) {
        this.io = io;

        await this.cargarParametrosRadar();
        this.conectarWebSocket();
    }

    async cargarParametrosRadar() {
        try {
            // 1. Cargar Geocercas (Puertos)
            const puertos = await MaritimoRepository.getPuertosParaMapa();

            // AISStream espera: [[LatMin, LonMin], [LatMax, LonMax]]
            this.geocercasActivas = puertos.map(p => [
                [parseFloat(p.bbox_lat_sur), parseFloat(p.bbox_lon_oeste)],
                [parseFloat(p.bbox_lat_norte), parseFloat(p.bbox_lon_este)]
            ]);

            // 2. Cargar Lista Blanca (Barcos esperados)
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

            // Si el túnel está abierto, re-enviamos la suscripción para aplicar los nuevos filtros
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.enviarSuscripcion();
            }
        } catch (error) {
            console.error('❌ [AIS Engine] Error recargando lista blanca:', error.message);
        }
    }

    async _procesarYPersistirAIS(aisMessage) {
        try {
            // 1. PROCESAR POSICIÓN (Latitud/Longitud)
            if (aisMessage.MessageType === 'PositionReport') {
                const reporte = aisMessage.Message.PositionReport;
                const mmsi = String(reporte.UserID);

                // 🛡️ Doble validación del Escudo Activo
                if (!this.MODO_PRUEBA_GLOBAL && !this.mmsiRastreados.has(mmsi)) return;

                const dataDTO = {
                    mmsi: mmsi,
                    lat: reporte.Latitude,
                    lon: reporte.Longitude,
                    velocidad: reporte.Sog,
                    rumbo: reporte.Cog,
                    estadoInferido: reporte.Sog < 0.5 ? 'DETENIDO' : 'EN MOVIMIENTO',
                    nombre_motonave: null, // No viene en esta trama
                    destino: null          // No viene en esta trama
                };

                await MaritimoRepository.guardarUltimaPosicionAIS(dataDTO);
            }

            // 2. PROCESAR DATOS ESTÁTICOS (Nombre/Destino)
            else if (aisMessage.MessageType === 'ShipStaticData') {
                const staticData = aisMessage.Message.ShipStaticData;
                const mmsi = String(staticData.UserID);

                // Solo nos importa si es un barco que ya tenemos en lista blanca
                if (!this.MODO_PRUEBA_GLOBAL && !this.mmsiRastreados.has(mmsi)) return;

                // console.log(`🏷️ [AIS Static] MMSI: ${mmsi} | Nombre: ${staticData.Name} | Destino: ${staticData.Destination}`);

                const staticDTO = {
                    mmsi: mmsi,
                    lat: null, // No actualizamos posición aquí
                    lon: null,
                    velocidad: null,
                    rumbo: null,
                    estadoInferido: null,
                    nombre_motonave: staticData.Name ? staticData.Name.trim() : null,
                    destino: staticData.Destination ? staticData.Destination.trim() : null
                };

                // Reutilizamos el mismo método del repositorio.
                // Gracias al COALESCE en tu SQL, si latitud/longitud vienen NULL, 
                // el MERGE los ignorará y solo actualizará el nombre y destino.
                await MaritimoRepository.guardarUltimaPosicionAIS(staticDTO);
            }

        } catch (error) {
            console.error(`⚠️ [AIS Engine] Falla al persistir trama AIS:`, error.message);
        }
    }

    // ================================================================
    // 3. FASE DE PROCESAMIENTO Y PERSISTENCIA
    // ================================================================
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
            // 🔥 LA CORRECCIÓN: Pedimos ambas tramas
            FilterMessageTypes: ["PositionReport", "ShipStaticData"]
        };

        this.ws.send(JSON.stringify(subscriptionMessage));
    }

    // ================================================================
    // 2. TÚNEL WEBSOCKET (Conexión Satelital)
    // ================================================================
    conectarWebSocket() {
        if (!process.env.AIS_API_KEY) {
            return;
        }

        // this.ws = new WebSocket("wss://stream.aisstream.io/v0/stream");

        // this.ws.on("open", () => {
        //     // this.enviarSuscripcion();
        // });

        // this.ws.on("message", async (data) => {
        //     try {
        //         const aisMessage = JSON.parse(data);
        //         await this._procesarYPersistirAIS(aisMessage);
        //     } catch (err) {
        //         // Se ignoran tramas rotas o JSON inválidos silenciosamente
        //     }
        // });

        // this.ws.on("error", (err) => {
        //     console.error("❌ [AIS Engine] Error en el túnel satelital:", err.message);
        // });

        // this.ws.on("close", () => {
        //     setTimeout(() => this.conectarWebSocket(), 5000);
        // });
    }
}

// Exportamos un Singleton para que index.js y SitmarEtlService compartan la misma instancia en memoria
module.exports = new AISStreamService();