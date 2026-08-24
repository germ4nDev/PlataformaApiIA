
// // iniciarRadarPorttos();
// const WebSocket = require('ws');

// // Configuración
// const API_KEY = process.env.AIS_API_KEY;

// const BBOX_PACIFICO_PLANO = [-79.0000, 1.0000, -76.0000, 8.0000];

// // Caribe ampliado (Incluye Cartagena, Barranquilla y Santa Marta)
// const BBOX_CARIBE_PLANO = [-78.0000, 7.5000, -71.0000, 13.5000];

// function iniciarRadarPorttos() {
//   console.log("📡 Conectando a la red global AIS...");
//   const socket = new WebSocket("wss://stream.aisstream.io/v0/stream");

//   // socket.onopen = function (_) {
//   //   console.log("✅ Conexión establecida. Suscribiendo al área marítima de TODA COLOMBIA (Caribe + Pacífico)...");

//   //   const subscriptionMessage = {
//   //     APIKey: API_KEY,
//   //     // 🚀 AQUÍ ESTÁ LA MAGIA: Pasamos ambas cajas en el arreglo
//   //     BoundingBoxes: [BBOX_PACIFICO, BBOX_CARIBE],
//   //     // Filtramos solo los mensajes de posición
//   //     FilterMessageTypes: ["PositionReport"]
//   //   };

//   //   socket.send(JSON.stringify(subscriptionMessage));
//   // };

//   // socket.onmessage = function (event) {
//   //   const aisMessage = JSON.parse(event.data);

//   //   if (aisMessage.MessageType === "PositionReport") {
//   //     const reporte = aisMessage.Message.PositionReport;
//   //     const metadatos = aisMessage.MetaData;

//   //     const datosNave = {
//   //       mmsi: metadatos.MMSI,
//   //       nombre: metadatos.ShipName ? metadatos.ShipName.trim() : 'DESCONOCIDO',
//   //       latitud: reporte.Latitude,
//   //       longitud: reporte.Longitude,
//   //       velocidad: reporte.Sog, // Speed over ground
//   //       rumbo: reporte.Cog, // Course over ground
//   //       timestamp: metadatos.time_utc
//   //     };

//   //     console.log(`🚢 Nave detectada: ${datosNave.nombre} (MMSI: ${datosNave.mmsi}) | Lat: ${datosNave.latitud}, Lon: ${datosNave.longitud}`);
//   //     if (io) {
//   //       // Opción A: Emisión global a todos los clientes conectados
//   //       io.emit('maritimo-actualizacion', featureSocket);

//   //       // Opción B (Si manejas salas en tu socket.io):
//   //       // io.to('sala-maritima').emit('maritimo-actualizacion', featureSocket);
//   //     }
//   //     // 🎯 AQUÍ ENTRA TU LÓGICA DE BASE DE DATOS
//   //     // (Ej. Upsert de la última posición en tu colección de MongoDB Atlas)
//   //     // actualizarTablaUltimaPosicion(datosNave);
//   //   }
//   // };
//   socket.onopen = function (_) {
//     console.log("✅ Conexión establecida. Suscribiendo al área marítima ampliada de Colombia...");
//     const subscriptionMessage = {
//       APIKey: API_KEY,
//       BoundingBoxes: [
//         BBOX_PACIFICO_PLANO,
//         BBOX_CARIBE_PLANO
//       ],
//       FilterMessageTypes: ["PositionReport"]
//     };
//     socket.send(JSON.stringify(subscriptionMessage));
//   };

//   socket.onmessage = function (event) {
//     const aisMessage = JSON.parse(event.data);

//     if (aisMessage.MessageType === "PositionReport") {
//       const reporte = aisMessage.Message.PositionReport;
//       const metadatos = aisMessage.MetaData;

//       if (reporte.Longitude >= -78.0 && reporte.Longitude <= -76.0) {
//         console.log(`🌊 [PACÍFICO DETECTADO] 🚢 ${metadatos.ShipName} | Lon: ${reporte.Longitude}, Lat: ${reporte.Latitude}`);
//       }

//       // Transformamos a GeoJSON
//       const featureSocket = {
//         type: "Feature",
//         geometry: {
//           type: "Point",
//           coordinates: [reporte.Longitude, reporte.Latitude]
//         },
//         properties: {
//           mmsi: metadatos.MMSI,
//           nombre_motonave: metadatos.ShipName ? metadatos.ShipName.trim() : 'DESCONOCIDO',
//           velocidad: reporte.Sog,
//           rumbo: reporte.Cog,
//           timestamp: metadatos.time_utc,
//           estado_nave: 'EN TRÁNSITO'
//         }
//       };

//       // 🎯 2. EMISIÓN AL FRONTEND
//       // Usamos el 'io' que inyectamos desde el index.js
//       if (io) {
//         // Opción A: Emisión global a todos los clientes conectados
//         io.emit('radar-actualizado', featureSocket);

//         // Opción B (Si manejas salas en tu socket.io):
//         // io.to('sala-maritima').emit('maritimo-actualizacion', featureSocket);
//       }
//     }
//   };

//   socket.onerror = function (error) {
//     console.error("❌ Error en el socket:", error);
//   };

//   socket.onclose = function () {
//     console.log("⚠️ Conexión cerrada. Intentando reconectar en 5 segundos...");
//     setTimeout(() => iniciarRadarGlobal(io), 5000);
//   };
// }

// module.exports = { iniciarRadarGlobal };
const WebSocket = require('ws');

const API_KEY = process.env.AIS_API_KEY;

// 🇨🇴 Formato estricto requerido por AISStream: [[[latMin, lonMin], [latMax, lonMax]], ...]
const BBOX_PACIFICO_OFICIAL = [1.0000, -82.0000, 8.0000, -76.0000]; // Lo pasaremos anidado abajo
const BBOX_CARIBE_OFICIAL = [7.5000, -78.0000, 13.5000, -71.0000];

function iniciarRadarGlobal(io) {
  console.log("📡 Conectando a la red global AIS...");
  const socket = new WebSocket("wss://stream.aisstream.io/v0/stream");

  socket.onopen = function (_) {
    console.log("✅ Conexión establecida. Suscribiendo con formato anidado oficial...");

    const subscriptionMessage = {
      APIKey: API_KEY,
      BoundingBoxes: [
        // [ [latMin, lonMin], [latMax, lonMax] ] -> Pacífico (Buenaventura / Tumaco)
        [[1.0000, -82.0000], [8.0000, -76.0000]],

        // [ [latMin, lonMin], [latMax, lonMax] ] -> Caribe (Cartagena / Barranquilla)
        [[7.5000, -78.0000], [13.5000, -71.0000]]
      ],
      FilterMessageTypes: ["PositionReport"]
    };

    socket.send(JSON.stringify(subscriptionMessage));
  };

  socket.onmessage = function (event) {
    const aisMessage = JSON.parse(event.data);

    if (aisMessage.MessageType === "PositionReport") {
      const reporte = aisMessage.Message.PositionReport;
      const metadatos = aisMessage.MetaData;

      // Depuración en consola para ver si cae algo del Pacífico
      if (reporte.Longitude >= -79.0 && reporte.Longitude <= -76.0 && reporte.Latitude >= 1.0 && reporte.Latitude <= 8.0) {
        console.log(`🌊 [PACÍFICO RECIBIDO] 🚢 ${metadatos.ShipName || 'DESCONOCIDO'} | Lon: ${reporte.Longitude}, Lat: ${reporte.Latitude}`);
      }

      const featureSocket = {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [reporte.Longitude, reporte.Latitude]
        },
        properties: {
          mmsi: metadatos.MMSI,
          nombre_motonave: metadatos.ShipName ? metadatos.ShipName.trim() : 'DESCONOCIDA',
          velocidad: reporte.Sog,
          rumbo: reporte.Cog,
          timestamp: metadatos.time_utc,
          estado_nave: 'EN TRÁNSITO'
        }
      };

      // if (io) {
      //   io.emit('radar-actualizado', featureSocket);
      // }
    }
  };

  socket.onerror = function (error) {
    console.error("❌ Error en el socket de AISStream:", error);
  };

  socket.onclose = function () {
    console.log("⚠️ Conexión cerrada. Reconectando en 5 segundos...");
    setTimeout(() => iniciarRadarGlobal(io), 5000);
  };
}

module.exports = { iniciarRadarGlobal };