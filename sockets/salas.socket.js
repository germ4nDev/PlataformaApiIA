/*
    Author: German Valencia
    Gestión de salas por puerto y módulo. Al reconectar, el cliente debe volver a unirse
    (el SocketService de Angular lo hace automáticamente).
*/
const { SALA_OPERACION, salaPuerto, esSalaValida } = require('../helpers/salas.helper');
const { puedeRecibirOperacion } = require('../middlewares/socket-auth');

function registrarSalas(io) {
  io.on('connection', (socket) => {
    const autorizado = puedeRecibirOperacion(socket);
    if (autorizado) socket.join(SALA_OPERACION);

    // Compatibilidad con el dashboard GNL actual
    socket.on('join-gnl', ({ puerto } = {}) => {
      if (autorizado && puerto) socket.join(salaPuerto(puerto, 'gnl'));
    });
    socket.on('leave-gnl', ({ puerto } = {}) => {
      if (puerto) socket.leave(salaPuerto(puerto, 'gnl'));
    });

    // API genérica: socket.emit('unirse-sala', 'puerto:BUENAVENTURA:gate')
    socket.on('unirse-sala', (sala) => {
      if (autorizado && esSalaValida(sala)) socket.join(sala);
    });
    socket.on('salir-sala', (sala) => {
      if (esSalaValida(sala)) socket.leave(sala);
    });
  });
}

module.exports = { registrarSalas };
