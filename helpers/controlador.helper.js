/*
    Author: German Valencia
    Pattern: PORTTOS Helper - Controladores
    Description: Piezas comunes de todo controlador de Porttos.
      - manejar(contexto, fn): envuelve el handler; cualquier error sale por responderError.
      - contextoUsuario(req): usuario para la auditoría, siempre desde el token (validarJWT).
*/
const { responderError } = require('./errores.helper');

const contextoUsuario = (req) => ({
  codigoUsuario: req.codigoUsuario || req.userNameUsuario || 'SISTEMA_ADMIN',
});

const manejar = (contexto, fn) => async (req, res, next) => {
  try {
    return await fn(req, res, next);
  } catch (error) {
    return responderError(res, error, contexto);
  }
};

module.exports = { contextoUsuario, manejar };
