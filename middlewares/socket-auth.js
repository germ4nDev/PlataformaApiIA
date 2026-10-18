/*
    Author: German Valencia
    Autenticación de Socket.IO con el mismo JWT de la API (header x-token).

    El cliente envía el token en el handshake: io(url, { auth: { token } }).
    SOCKET_AUTH_STRICT=true  → rechaza conexiones sin token válido.
    SOCKET_AUTH_STRICT=false → (transición) permite la conexión anónima pero la registra en log.
*/
const jwt = require('jsonwebtoken');

const esModoEstricto = () => process.env.SOCKET_AUTH_STRICT === 'true';

function extraerToken(socket) {
  const { auth = {}, headers = {} } = socket.handshake || {};
  return auth.token || headers['x-token'] || null;
}

function socketAuth(socket, next) {
  const token = extraerToken(socket);
  socket.data.autenticado = false;

  if (token) {
    try {
      const { codigoUsuario, userNameUsuario, correoUsuario, roleUsuario } = jwt.verify(token, process.env.JWT_SECRET);
      socket.data.usuario = { codigoUsuario, userNameUsuario, correoUsuario, roleUsuario };
      socket.data.autenticado = true;
      return next();
    } catch (error) {
      if (esModoEstricto()) return next(new Error('TOKEN_INVALIDO'));
      console.warn(`⚠️ [SOCKET] Token inválido (${error.message}) · socket ${socket.id} admitido en modo transición.`);
      return next();
    }
  }

  if (esModoEstricto()) return next(new Error('NO_AUTORIZADO'));
  console.warn(`⚠️ [SOCKET] Conexión sin token · socket ${socket.id} admitido en modo transición.`);
  return next();
}

/** ¿El socket puede recibir datos operativos? */
const puedeRecibirOperacion = (socket) => socket.data.autenticado || !esModoEstricto();

module.exports = { socketAuth, puedeRecibirOperacion, esModoEstricto };
