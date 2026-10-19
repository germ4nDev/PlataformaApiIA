/*
    Author: German Valencia
    Pattern: PORTTOS Adapter - AISStream (websocket)
    Description: Conexión con wss://stream.aisstream.io. Entrega cada trama ya parseada (o null si no es JSON)
      y expone suscribir/cerrar/estado. La lógica (zonas, estados, escritura, reconexión) es del motor AIS.
*/
const WebSocket = require('ws');

const URL_AISSTREAM = 'wss://stream.aisstream.io/v0/stream';

/**
 * @param {{ alAbrir?: Function, alMensaje: (msg: object|null) => void, alError?: Function, alCerrar?: Function }} eventos
 */
function conectar({ alAbrir, alMensaje, alError, alCerrar }) {
  const ws = new WebSocket(URL_AISSTREAM);
  if (alAbrir) ws.on('open', alAbrir);
  ws.on('message', (data) => {
    let msg = null;
    try { msg = JSON.parse(data); } catch { msg = null; }
    alMensaje(msg);
  });
  if (alError) ws.on('error', alError);
  if (alCerrar) ws.on('close', alCerrar);

  return {
    /** Envía la suscripción: cajas [[ [lat,lon], [lat,lon] ], ...] y, opcionalmente, la lista de MMSI. */
    suscribir(cajas, mmsis = []) {
      const suscripcion = {
        APIKey: process.env.AIS_API_KEY,
        BoundingBoxes: cajas,
        FilterMessageTypes: ['PositionReport', 'ShipStaticData'],
      };
      if (mmsis.length > 0) suscripcion.FiltersShipMMSI = mmsis;
      ws.send(JSON.stringify(suscripcion));
    },
    cerrar() { try { ws.close(); } catch { /* sin acción */ } },
    abierto: () => ws.readyState === WebSocket.OPEN,
    cerrado: () => ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING,
  };
}

module.exports = { conectar, URL_AISSTREAM };
