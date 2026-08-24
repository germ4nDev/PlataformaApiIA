// /*
//     Author: German Valencia
//     Service: Simulador de Eventos en Tiempo Real (Torre de Control MVP)
// */
// const mockAgentsService = require('../torre-control/mock-agents.service');

// class SimuladorEventosService {

//   iniciarSimulacionTiempoReal(io) {
//     console.log("🟢 Simulador de Torre de Control Iniciado - WebSockets Activos");

//     // Bucle de 8 segundos para refrescar el tablero de la junta directiva
//     setInterval(async () => {
//       try {
//         // 1. Obtenemos la data del mock (simulando lectura de DB/API externa)
//         const buques = await mockAgentsService.getDatosMaritimos();

//         // 2. Modificamos un dato aleatorio para generar la sensación de "operación viva"
//         const buqueAleatorio = buques[Math.floor(Math.random() * buques.length)];

//         if (buqueAleatorio.estado === 'warning') {
//           buqueAleatorio.estado = 'success';
//           buqueAleatorio.est = 'Atracando';

//           // Emitimos una alerta de IA para que el frontend muestre una notificación
//           io.emit('nueva_alerta_ia', {
//             nivel: 'info',
//             mensaje: `El buque ${buqueAleatorio.mv} acaba de iniciar maniobra de atraque en ${buqueAleatorio.term}.`
//           });
//         }

//         // 3. Empujamos el array completo al frontend
//         io.emit('update_maritimo', buques);

//       } catch (error) {
//         // console.error("🔴 Error en el ciclo del simulador:", error);
//       }
//     }, 8000);
//   }
// }

// module.exports = new SimuladorEventosService();

/*
    Author: German Valencia
    Service: Simulador de Eventos en Tiempo Real (Torre de Control MVP)
*/
const mockAgentsService = require('./mock-agents.service');

class SimuladorEventosService {

  iniciarSimulacionTiempoReal(io) {
    // console.log("🟢 Simulador de Torre de Control Iniciado - WebSockets Activos");

    // Bucle de 8 segundos para refrescar el tablero de la junta directiva
    setInterval(async () => {
      try {
        // 1. Usamos el método correcto: obtenerDatosPortuarios()
        const datosPuerto = await mockAgentsService.obtenerDatosPortuarios();

        if (datosPuerto && datosPuerto.terminales && datosPuerto.terminales.length > 0) {
          // 2. Modificamos un dato aleatorio para generar la sensación de "operación viva"
          const terminalAleatorio = datosPuerto.terminales[Math.floor(Math.random() * datosPuerto.terminales.length)];

          // Simulamos fluctuación en la ocupación y movimiento de toneladas
          const variacionOcupacion = Math.floor(Math.random() * 5) - 2; // Sube o baja un poco
          terminalAleatorio.ocupacion = Math.max(0, Math.min(100, terminalAleatorio.ocupacion + variacionOcupacion));
          terminalAleatorio.toneladasHoy += Math.floor(Math.random() * 100);

          // Emitimos una alerta de IA esporádica (30% de probabilidad) para dar efecto "Wow"
          if (Math.random() > 0.7) {
            io.emit('nueva_alerta_ia', {
              nivel: 'info',
              mensaje: `Fluctuación operativa detectada en ${terminalAleatorio.id}: Ocupación actual ${terminalAleatorio.ocupacion}%.`
            });
          }
        }

        // 3. Empujamos el objeto completo (terminales y bodegas) al frontend
        io.emit('update_maritimo', datosPuerto);

      } catch (error) {
        // console.error("🔴 Error en el ciclo del simulador:", error);
      }
    }, 8000);
  }
}

module.exports = new SimuladorEventosService();