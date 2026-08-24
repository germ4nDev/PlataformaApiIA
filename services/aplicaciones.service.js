/*
    Author: German Valencia
    Refactored for: QPLUS Standard (Clean Service Layer)
*/
const { sequelize } = require('../database/connection');
const { AplicacionModel, AplicacionDTO } = require('../models/aplicacion');
const { io } = require('../index');

class AplicacionesService {
  constructor() {
    this.model = AplicacionModel(sequelize);
  }

  async getAplicaciones(filtros = {}, esParaIA = false) {
    try {
      const queryOptions = {
        where: filtros,
      };

      if (esParaIA) {
        queryOptions.attributes = [
          'nombreAplicacion',
          'descripcionAplicacion',
          'descripcionAplicacion',
          'imagenInicio'
        ];
      }

      return await this.model.findAll(queryOptions);

    } catch (error) {
      console.error("Error en AplicacionesService:", error);
      throw error;
    }
  }

  async getAplicacionByCode(codigoAplicacion) {
    const registro = await this.model.findOne({ where: { codigoAplicacion } });
    if (!registro) throw { statusCode: 404, msg: "No existe la aplicación." };
    return registro;
  }

  async crearAplicacion(rawData) {
    try {
      const dataDTO = AplicacionDTO(rawData);

      return await sequelize.transaction(async (t) => {
        const nuevaAplicacion = await this.model.create(dataDTO, { transaction: t });
        console.log('Aplicación creada en BD:', nuevaAplicacion.toJSON());
        if (typeof io !== 'undefined') {
          io.emit('aplicaciones-actualizadas', {
            action: 'create',
            msg: `Aplicación creada: ${nuevaAplicacion.nombreAplicacion}`
          });
        }

        return nuevaAplicacion;
      });

    } catch (error) {
      // Quitamos el .message para ver todo el objeto del error
      console.error('🔴 Error COMPLETO en crearAplicacion:', error);
      throw error;
    }
  }

  async updateAplicacion(codigoAplicacion, rawData) {
    try {
      const dataDTO = AplicacionDTO(rawData);

      return await sequelize.transaction(async (t) => {
        const dbApp = await this.model.findOne({
          where: { codigoAplicacion },
          transaction: t
        });

        if (!dbApp) {
          throw { statusCode: 404, msg: "No existe la aplicación para actualizar." };
        }

        await this.model.update(dataDTO, {
          where: { codigoAplicacion },
          transaction: t
        });

        const actualizada = await this.model.findOne({
          where: { codigoAplicacion },
          transaction: t
        });

        if (typeof io !== 'undefined') {
          io.emit('aplicaciones-actualizadas', {
            action: 'update',
            msg: `Aplicación actualizada: ${actualizada.nombreAplicacion}`
          });
        }

        return actualizada;
      });

    } catch (error) {
      console.error(`Error en updateAplicacion:`, error.msg || error.message);
      throw error;
    }
  }

  async deleteAplicacion(codigoAplicacion) {
    try {
      return await sequelize.transaction(async (t) => {
        const dbApp = await this.model.findOne({
          where: { codigoAplicacion },
          transaction: t
        });

        if (!dbApp) {
          throw { statusCode: 404, msg: "No existe una aplicación con ese código." };
        }

        await this.model.destroy({
          where: { codigoAplicacion },
          transaction: t
        });

        if (typeof io !== 'undefined') {
          io.emit('aplicaciones-actualizadas', {
            action: 'delete',
            msg: `Aplicación eliminada: ${dbApp.nombreAplicacion}`
          });
        } else {
          console.warn('Objeto IO no definido. Se eliminó en BD pero no se notificó por socket.');
        }

        return dbApp;
      });

    } catch (error) {
      console.error(`Error en deleteAplicacion (Rollback):`, error.msg || error.message);
      throw error;
    }
  }
}

module.exports = AplicacionesService;