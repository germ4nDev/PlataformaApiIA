/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Service Layer Sanitization & Transactional Integrity
*/
const { sequelize } = require('../database/connection');
const { PaqueteSCModel, PaqueteSCDTO } = require('../models/paquete-sc');
const { getIO } = require('../helpers/socket.helper');
const ListasPrecios = require('./plataforma/listas-precios.service');
const Aprovisionamiento = require('./plataforma/aprovisionamiento.service');

// OT-029: la foto del precio la pone el API al vender; después no se cambia por PUT
const FOTO = ['codigoLista', 'moneda', 'periodicidad', 'mesesCobertura', 'valorPeriodo', 'precioSetup', 'porcentajeDescuento', 'valorFinal'];

class PaqueteSCService {
  constructor() {
    this.model = PaqueteSCModel(sequelize);
  }

  async getPaquetesSC(filtros = {}, esParaIA = false) {
    try {
      const queryOptions = {
        where: filtros,
      };

      if (esParaIA) {
        queryOptions.attributes = [
          'nombrePaquete',
          'descripcionPaquete',
          'precioPaquete',
          'estadoPaquete'
        ];
      }

      return await this.model.findAll(queryOptions);

    } catch (error) {
      console.error("Error en PaquetesService:", error);
      throw error;
    }
  }

  async getPaqueteSCById(suscriptorPaqueteId) {
    const registro = await this.model.findOne({ where: { suscriptorPaqueteId } });
    if (!registro) throw { statusCode: 404, msg: "No existe el paquete de suscriptor solicitado." };
    return registro;
  }

  async createPaqueteSC(rawData) {
    // console.log('crear paquete sc raw', rawData);   // [ruido de consola: comentado 2026-10-26]

    const dataDTO = PaqueteSCDTO(rawData);
    // OT-029: precio de la lista elegida (o la vigente) con los meses y el descuento del tipo de paquete
    const foto = await ListasPrecios.cotizar({ codigoPaquete: dataDTO.codigoPaquete, codigoTipoPaquete: dataDTO.codigoTipoPaquete, codigoLista: rawData.codigoLista || '' });
    Object.assign(dataDTO, foto);
    // console.log('crear paquete sc dto', dataDTO);   // [ruido de consola: comentado 2026-10-26]

    return await sequelize.transaction(async (t) => {
      const nuevoPaquete = await this.model.create(dataDTO, { transaction: t });

      // OT-030: la base de cada aplicación del paquete se crea después del commit (abajo), sin bloquear la venta.

      getIO().emit('paquetes-sc-actualizados', {
        action: 'create',
        msg: `Paquete SC creado: ${nuevoPaquete.suscriptorPaqueteId}`
      });

      return nuevoPaquete;
    }).then((nuevoPaquete) => {
      // OT-030: una base por aplicación del paquete (menos la Plataforma); si falla queda ERROR y se reintenta desde la pantalla
      Aprovisionamiento.encolar({ codigoSuscriptor: dataDTO.codigoSuscriptor, codigoPaquete: dataDTO.codigoPaquete })
        .catch((e) => console.error('❌ [Aprovisionamiento] No se pudo encolar:', e?.message || e?.msg || e));
      return nuevoPaquete;
    });
  }

  async updatePaqueteSC(codigoSuscriptorPaquete, rawData) {
    // console.log('codigo', codigoSuscriptorPaquete);   // [ruido de consola: comentado 2026-10-26]
    // console.log('paquete sc', rawData);   // [ruido de consola: comentado 2026-10-26]

    return await sequelize.transaction(async (t) => {
      // 1. Buscamos si existe
      const registroDB = await this.model.findOne({
        where: { codigoSuscriptorPaquete },
        transaction: t
      });

      // console.log('registroDB', registroDB);   // [ruido de consola: comentado 2026-10-26]
      if (!registroDB) throw { statusCode: 404, msg: 'No existe el paquete SC para actualizar.' };

      // 2. Actualizamos (sin tocar la foto del precio, OT-029)
      const cambios = { ...rawData };
      for (const k of FOTO) delete cambios[k];
      await this.model.update(cambios, {
        where: { codigoSuscriptorPaquete },
        transaction: t
      });

      // 3. 🟢 CORRECCIÓN: Buscamos de nuevo usando la variable correcta
      const actualizado = await this.model.findOne({
        where: { codigoSuscriptorPaquete },
        transaction: t
      });

      // 4. 🟢 CORRECCIÓN: Usamos la propiedad correcta para el mensaje del socket
      getIO().emit('paquetes-sc-actualizados', {
        action: 'update',
        msg: `Paquete SC actualizado: ${actualizado.codigoSuscriptorPaquete}`
      });

      return actualizado;
    });
  }

  async deletePaqueteSC(suscriptorPaqueteId) {
    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { suscriptorPaqueteId },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: 'No existe el paquete SC para eliminar.' };

      const idEliminado = registroDB.suscriptorPaqueteId;

      await this.model.destroy({
        where: { suscriptorPaqueteId },
        transaction: t
      });

      getIO().emit('paquetes-sc-actualizados', {
        action: 'delete',
        msg: `Paquete SC eliminado: ${idEliminado}`
      });

      return true;
    });
  }
}

module.exports = PaqueteSCService;