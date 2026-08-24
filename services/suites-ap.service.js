/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Service Layer Sanitization & Transactional Integrity
*/
const { sequelize } = require('../database/connection');
const { SuiteAPModel, SuiteAPDTO } = require('../models/suites-ap');
const { io } = require('../index');

class SuitesAPService {
  constructor() {
    this.model = SuiteAPModel(sequelize);
  }

  async getSuites() {
    return await this.model.findAll();
  }

  async getSuiteById(codigoSuite) {
    const registro = await this.model.findOne({ where: { codigoSuite } });
    if (!registro) throw { statusCode: 404, msg: "No existe la suite solicitada." };
    return registro;
  }

  async createSuite(rawData) {
    try {
      const dataDTO = SuiteAPDTO(rawData);
      return await sequelize.transaction(async (t) => {
        const existe = await this.model.findOne({
          where: {
            codigoAplicacion: dataDTO.codigoAplicacion,
            nombreSuite: dataDTO.nombreSuite
          },
          transaction: t
        });

        if (existe) throw { statusCode: 400, msg: "Esta suite ya existe para la aplicacion." };

        const nuevaSuite = await this.model.create(dataDTO, { transaction: t });

        console.log('Suite creada en BD:', nuevaSuite.toJSON());
        if (typeof io !== 'undefined') {
          io.emit('suites-actualizadas', {
            action: 'create',
            msg: `Suite creada: ${nuevaSuite.nombreSuite}`
          });
        }

        return nuevaSuite;
      });
    } catch (error) {
      console.error('Error COMPLETO en crearSuite:', error);
      throw error;
    }
  }

  async updateSuite(codigoSuite, rawData) {
    try {
      const dataDTO = SuiteAPDTO(rawData);

      return await sequelize.transaction(async (t) => {
        const registroDB = await this.model.findOne({
          where: { codigoSuite },
          transaction: t
        });

        if (!registroDB) throw { statusCode: 404, msg: 'No existe la suite para actualizar.' };

        await this.model.update(dataDTO, {
          where: { codigoSuite },
          transaction: t
        });

        const actualizada = await this.model.findOne({
          where: { codigoSuite },
          transaction: t
        });

        io.emit('suites-actualizados', {
          action: 'update',
          msg: `Suite actualizada: ${actualizada.nombreSuite}`
        });

        return actualizada;
      });
    } catch (error) {
      console.error('Error COMPLETO en updateSuite:', error);
      throw error;
    }
  }

  async deleteSuite(codigoSuite) {
    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoSuite },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: 'No existe la suite con ese ID para eliminar.' };

      const nombreSuite = registroDB.nombreSuite;

      await this.model.destroy({
        where: { codigoSuite },
        transaction: t
      });

      io.emit('suites-actualizados', {
        action: 'delete',
        msg: `Suite eliminada: ${nombreSuite}`
      });

      return true;
    });
  }
}

module.exports = SuitesAPService;