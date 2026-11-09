/*
    Author: German Valencia
    Pattern: PLATAFORMA Service - Aplicaciones con licencia de un suscriptor (OT-026)
    Description:
      aplicaciones(params)   [{ codigoAplicacion, nombreAplicacion }] que el suscriptor tiene en paquetes con licencia activa. La usa la
                             asignación de roles del usuario (suscriptor → empresa → aplicación → roles).
*/
const Repo = require('../../repositories/plataforma/aplicaciones-suscriptor.repository');
const { validarCon } = require('../../helpers/errores.helper');
const { AplicacionesSuscriptorParamsSchema } = require('../../models/plataforma/aplicaciones-suscriptor.model');
const { normalizarAplicaciones } = require('../../utils/plataforma/asignacion-roles');

class AplicacionesSuscriptorService {
  constructor({ repo = Repo } = {}) {
    this.repo = repo;
  }

  async aplicaciones(params) {
    const { codigoSuscriptor } = validarCon(AplicacionesSuscriptorParamsSchema, params);
    return normalizarAplicaciones(await this.repo.aplicacionesDeSuscriptor(codigoSuscriptor));
  }
}

module.exports = new AplicacionesSuscriptorService();
module.exports.AplicacionesSuscriptorService = AplicacionesSuscriptorService;
