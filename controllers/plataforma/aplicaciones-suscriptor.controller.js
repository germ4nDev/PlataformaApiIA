/*
    Author: German Valencia
    Pattern: PLATAFORMA Controller - Aplicaciones con licencia de un suscriptor (OT-026)
    Ruta (JWT + sesión, solo lectura):
      GET /api/suscriptores/:codigoSuscriptor/aplicaciones   { ok: true, aplicaciones: [{ codigoAplicacion, nombreAplicacion }] }
*/
const Servicio = require('../../services/plataforma/aplicaciones-suscriptor.service');
const { responderError } = require('../../helpers/errores.helper');

const getAplicacionesSuscriptor = async (req, res) => {
  try {
    const aplicaciones = await Servicio.aplicaciones(req.params);
    return res.status(200).json({ ok: true, aplicaciones });
  } catch (error) {
    return responderError(res, error, 'AplicacionesSuscriptor.listar');
  }
};

module.exports = { getAplicacionesSuscriptor };
