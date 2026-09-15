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
  }
};