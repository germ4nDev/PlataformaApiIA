/*
    Author: German Valencia
    Pattern: PORTTOS Controller Pattern - KPIs marítimos en vivo
    Rutas (con JWT, en routes/torre-control/maritimo.routes.js):
      GET /api/maritimo/:puerto/resumen    ?vigenciaMin=60&limiteCola=20
      GET /api/maritimo/:puerto/tiempos    ?dias=30
      GET /api/maritimo/:puerto/ocupacion  ?vigenciaMin=60
      GET /api/maritimo/:puerto/llegadas   ?horas=72&horasAtras=12&limite=200
    Respuesta: { ok: true, data }. Errores con helpers/errores.helper (400/404/503/500).
*/
const MaritimoVivoService = require('../../services/torre-control/maritimo-vivo.service');
const {
  PuertoParamSchema, ResumenQuerySchema, TiemposQuerySchema, OcupacionQuerySchema, LlegadasQuerySchema,
} = require('../../models/torre-control/maritimo-vivo.model');
const { responderError, validarCon } = require('../../helpers/errores.helper');

const responder = (metodo, esquemaQuery) => async (req, res) => {
  try {
    const { puerto } = validarCon(PuertoParamSchema, req.params);
    const opciones = validarCon(esquemaQuery, req.query);
    const data = await MaritimoVivoService[metodo](puerto, opciones);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return responderError(res, error, `MaritimoVivo.${metodo}`);
  }
};

module.exports = {
  obtenerResumenVivo: responder('resumen', ResumenQuerySchema),
  obtenerTiemposVivo: responder('tiempos', TiemposQuerySchema),
  obtenerOcupacionVivo: responder('ocupacion', OcupacionQuerySchema),
  obtenerLlegadasVivo: responder('llegadas', LlegadasQuerySchema),
};
