/*
    Author: German Valencia
    Refactored for: QPLUS Architecture - Sockets & Sesiones
*/
const { uuid } = require('uuidv4');
const SesionesService = require('../services/sesiones.service');
const sesionesService = new SesionesService();

const socketToSesionMap = new Map();

function configurarSockets(io) {
  io.on('connection', (socket) => {
    console.log(`🔌 Cliente conectado al socket: ${socket.id}`);

    // 🟢 ESCUCHA EL EVENTO QUE MANDA ANGULAR TRAS EL LOGIN
    socket.on('registrar_sesion', async (userData) => {
      try {
        console.log('📥 Recibido evento registrar_sesion desde Angular:', userData);

        // Si ya había una sesión previa en este socket, la cerramos
        if (socketToSesionMap.has(socket.id)) {
          const viejoCodigo = socketToSesionMap.get(socket.id);
          await sesionesService.cerrarSesion(viejoCodigo);
        }

        const payload = {
          codigoSesion: userData.codigoSesion || uuid(),
          codigoUsuario: userData.id,
          codigoSuscriptor: userData.codigoSuscriptor || null,
          codigoSuite: userData.codigoSuite || null,
          codigoAplicacion: userData.codigoAplicacion || null,
          codigoModulo: userData.codigoModulo || 'Dashboard Principal',
          nombreUsuario: userData.nombre,
          rol: userData.rol,
          correo: userData.correo,
          dispositivo: userData.dispositivo || 'Desktop',
          activa: true,
          fechaLogin: new Date().toISOString()
        };

        // 💾 AQUÍ SE PERSISTE EN LA BASE DE DATOS MEDIANTE SEQUELIZE
        const nuevaSesion = await sesionesService.registrarSesion(payload);

        // Mapeamos el socket.id con el codigoSesion de la BD
        socketToSesionMap.set(socket.id, nuevaSesion.codigoSesion);
        console.log(`✅ ¡Sesión guardada en BD! UUID: ${nuevaSesion.codigoSesion} para usuario: ${nuevaSesion.nombreUsuario}`);

      } catch (error) {
        console.error("❌ Error al registrar sesión por socket en BD:", error);
      }
    });

    // Actualización de contexto en tiempo real
    socket.on('actualizar_contexto_sesion', async (datosContexto) => {
      try {
        const codigoSesion = socketToSesionMap.get(socket.id);
        if (codigoSesion) {
          await sesionesService.actualizarContextoNavegacion(codigoSesion, datosContexto);
        }
      } catch (error) {
        console.error("❌ Error al actualizar contexto por socket:", error);
      }
    });

    // Desconexión (Capa 8)
    socket.on('disconnect', async () => {
      try {
        const codigoSesion = socketToSesionMap.get(socket.id);
        if (codigoSesion) {
          await sesionesService.cerrarSesion(codigoSesion);
          socketToSesionMap.delete(socket.id);
          console.log(`🔒 Sesión ${codigoSesion} cerrada por desconexión.`);
        }
      } catch (error) {
        console.error("❌ Error al cerrar sesión por desconexión:", error);
      }
    });
  });
}

module.exports = { configurarSockets };