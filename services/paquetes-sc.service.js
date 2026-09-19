/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Service Layer Sanitization & Transactional Integrity
*/
const { sequelize } = require('../database/connection');
const { PaqueteSCModel, PaqueteSCDTO } = require('../models/paquete-sc');
const { getIO } = require('../helpers/socket.helper');

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
    console.log('crear paquete sc raw', rawData);

    const dataDTO = PaqueteSCDTO(rawData);
    console.log('crear paquete sc dto', dataDTO);

    return await sequelize.transaction(async (t) => {
      const nuevoPaquete = await this.model.create(dataDTO, { transaction: t });

      crearBaseDatosSuscriptor();

      getIO().emit('paquetes-sc-actualizados', {
        action: 'create',
        msg: `Paquete SC creado: ${nuevoPaquete.suscriptorPaqueteId}`
      });

      return nuevoPaquete;
    });
  }

  async crearBaseDatosSuscriptor() {
    const modulosPQ = await this.moduloPQModel.findAll({
      where: { codigoPaquete: dataDTO.codigoPaquete },
      transaction: t
    });
    console.log('4️⃣ [DEBUG] Módulos encontrados:', modulosPQ ? modulosPQ.length : 0);

    if (modulosPQ && modulosPQ.length > 0) {
      const codigosAppsUnicas = [...new Set(modulosPQ.map(mod => mod.codigoAplicacion))];

      const aplicaciones = await this.aplicacionModel.findAll({
        where: { codigoAplicacion: codigosAppsUnicas },
        transaction: t
      });
      console.log('5️⃣ [DEBUG] Aplicaciones encontradas:', aplicaciones ? aplicaciones.length : 0);

      for (const app of aplicaciones) {
        this.provisionService.clonarBaseDeDatos(
          dataDTO.codigoSuscriptor,
          app.plantillaBD,
          app.prefijoBD
        ).catch(err => console.error(`❌ Error clonando BD manual app ${app.codigoAplicacion}:`, err));
      }
    }
  }

  async updatePaqueteSC(codigoSuscriptorPaquete, rawData) {
    console.log('codigo', codigoSuscriptorPaquete);
    console.log('paquete sc', rawData);

    return await sequelize.transaction(async (t) => {
      // 1. Buscamos si existe
      const registroDB = await this.model.findOne({
        where: { codigoSuscriptorPaquete },
        transaction: t
      });

      console.log('registroDB', registroDB);
      if (!registroDB) throw { statusCode: 404, msg: 'No existe el paquete SC para actualizar.' };

      // 2. Actualizamos
      await this.model.update(rawData, {
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