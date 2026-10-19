let ioInstance;

module.exports = {
  setIO: (io) => {
    ioInstance = io;
  },
  getIO: () => {
    if (!ioInstance) {
      throw new Error("⚠️ Socket.io no ha sido inicializado.");
    }
    return ioInstance;
  },
  /**
   * Emite un evento a todos los clientes (o a una sala) sin fallar si el socket aún no existe
   * (pruebas, procesos que arrancan antes del servidor). Los servicios usan esto, nunca require('index').
   */
  emitir: (evento, datos, sala) => {
    if (!ioInstance) return false;
    (sala ? ioInstance.to(sala) : ioInstance).emit(evento, datos);
    return true;
  }
};