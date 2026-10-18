/*
    Author: German Valencia
    Pattern: PORTTOS Middleware - Manejador central de errores (va DESPUÉS de todas las rutas)
    Description: Atrapa lo que ningún controlador respondió: JSON mal formado, cuerpo demasiado grande
      y cualquier next(error). Responde JSON uniforme (helpers/errores.helper) en vez de la página HTML
      de Express, que en desarrollo incluye la traza del servidor.
      No cambia los controladores existentes: los que ya responden sus errores siguen igual.
*/
const { responderError, crearError } = require('../helpers/errores.helper');

// eslint-disable-next-line no-unused-vars
const manejadorErrores = (error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error?.type === 'entity.parse.failed') {
    return responderError(res, crearError(400, 'El cuerpo de la petición no es un JSON válido', 'JSON_INVALIDO'));
  }
  if (error?.type === 'entity.too.large') {
    return responderError(res, crearError(413, 'El cuerpo de la petición es demasiado grande', 'CUERPO_GRANDE'));
  }
  return responderError(res, error, `${req.method} ${req.originalUrl}`);
};

module.exports = manejadorErrores;
