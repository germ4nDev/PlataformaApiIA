/*
    Author: German Valencia
    Pattern: PORTTOS Controller - Tableros por pestaña (Granel, Carga suelta, Capacidad, Noticias)
    Rutas (con JWT, en routes/torre-control/tableros-pestanas.routes.js):
      GET /api/tableros/granel/:puerto        → TLC_GRANEL_001
      GET /api/tableros/carga-suelta/:puerto  → TLC_SUELTA_001
      GET /api/tableros/capacidad/:puerto     → TLC_CAPACIDAD_001
      GET /api/tableros/noticias/:puerto      → TLC_NOTICIAS
    Respuesta: { ok: true, data } con los KPIs por código de widget y los datos de cada widget.
    Sin la migración 013 responde 503 (MIGRACION_PENDIENTE).
*/
const TablerosOperacionService = require('../../services/torre-control/tableros-operacion.service');
const NoticiasService = require('../../services/torre-control/noticias.service');
const { PuertoParamSchema } = require('../../models/torre-control/ingesta-operacion.model');
const { responderError, validarCon } = require('../../helpers/errores.helper');

const responder = (contexto, obtener) => async (req, res) => {
  try {
    const { puerto } = validarCon(PuertoParamSchema, req.params);
    const data = await obtener(puerto);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return responderError(res, error, contexto);
  }
};

module.exports = {
  obtenerGranel: responder('Tableros.granel', (p) => TablerosOperacionService.granel(p)),
  obtenerCargaSuelta: responder('Tableros.cargaSuelta', (p) => TablerosOperacionService.cargaSuelta(p)),
  obtenerCapacidad: responder('Tableros.capacidad', (p) => TablerosOperacionService.capacidad(p)),
  obtenerNoticias: responder('Tableros.noticias', (p) => NoticiasService.tablero(p)),
};
