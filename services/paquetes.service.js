/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Service Layer Sanitization & Transactional Integrity
*/
const { sequelize } = require('../database/connection');
const { PaqueteModel, PaqueteDTO } = require('../models/paquete');
const { getIO } = require('../helpers/socket.helper');

class PaqueteService {
  constructor() {
    this.model = PaqueteModel(sequelize);
  }

  async getPaquetes(filtros = {}, esParaIA = false) {
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

  async getPaqueteById(codigoPaquete) {
    const registro = await this.model.findOne({ where: { codigoPaquete } });
    if (!registro) throw { statusCode: 404, msg: "No existe el paquete solicitado." };
    return registro;
  }

  async createPaquete(rawData) {
    const dataDTO = PaqueteDTO(rawData);

    return await sequelize.transaction(async (t) => {
      // Optimización QPLUS: Ejecución en paralelo de validaciones independientes
      const [existente, existeNombre] = await Promise.all([
        this.model.findOne({ where: { codigoPaquete: dataDTO.codigoPaquete }, transaction: t }),
        this.model.findOne({ where: { nombrePaquete: dataDTO.nombrePaquete }, transaction: t })
      ]);

      if (existente) throw { statusCode: 400, msg: `El código ${dataDTO.codigoPaquete} ya está registrado.` };
      if (existeNombre) throw { statusCode: 400, msg: 'Ya existe un paquete con ese nombre.' };

      const nuevo = await this.model.create(dataDTO, { transaction: t });

      getIO().emit('paquetes-actualizados', {
        action: 'create',
        msg: `Paquete creado: ${nuevo.nombrePaquete}`
      });

      return nuevo;
    });
  }

  async updatePaquete(codigoPaquete, rawData) {
    // El controlador inyecta el codigoUsuario en rawData antes de invocar el servicio
    const dataDTO = PaqueteDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoPaquete },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: "No existe el paquete para actualizar." };

      await this.model.update(dataDTO, {
        where: { codigoPaquete },
        transaction: t
      });

      const actualizado = await this.model.findOne({
        where: { codigoPaquete },
        transaction: t
      });

      getIO().emit('paquetes-actualizados', {
        action: 'update',
        msg: `Paquete actualizado: ${actualizado.nombrePaquete}`
      });

      return actualizado;
    });
  }

  async deletePaquete(codigoPaquete) {
    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoPaquete },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: "No existe el paquete con ese código para eliminar." };

      const nombrePaquete = registroDB.nombrePaquete;

      await this.model.destroy({
        where: { codigoPaquete },
        transaction: t
      });

      getIO().emit('paquetes-actualizados', {
        action: 'delete',
        msg: `Paquete eliminado: ${nombrePaquete}`
      });

      return true;
    });
  }
}

module.exports = PaqueteService;