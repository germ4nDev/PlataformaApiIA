/*
    Author: German Valencia
    Pattern: PORTTOS Controller - Ingesta de operación portuaria
    Ruta (con JWT, en routes/torre-control/ingesta-operacion.routes.js):
      POST /api/ingesta-operacion/:tipo   { puerto, fuente?, registros: [...] }
      tipos: operaciones-buque | avance | equipos | carga-suelta | vehiculos | ocupacion-nodos | nodos
    Respuesta: { ok: true, data: { tipo, puerto, recibidos, guardados } }. Registros inválidos → 400 sin guardar nada.
*/
const IngestaOperacionService = require('../../services/torre-control/ingesta-operacion.service');
const { IngestaParamSchema, IngestaCuerpoSchema } = require('../../models/torre-control/ingesta-operacion.model');
const { responderError, validarCon } = require('../../helpers/errores.helper');

const ingerir = async (req, res) => {
  try {
    const { tipo } = validarCon(IngestaParamSchema, req.params);
    const cuerpo = validarCon(IngestaCuerpoSchema, req.body);
    const data = await IngestaOperacionService.ingerir(tipo, cuerpo);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return responderError(res, error, 'IngestaOperacion.ingerir');
  }
};

module.exports = { ingerir };
