/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Service Layer Sanitization & Transactional Integrity
*/
const { sequelize } = require('../database/connection');
const { TipoItemModel, TipoItemDTO } = require('../models/tipo-item');
const { getIO } = require('../helpers/socket.helper');

class TiposItemService {
  constructor() {
    this.model = TipoItemModel(sequelize);
  }

  async getTiposItem(filtros = {}, esParaIA = false) {
    try {
      const queryOptions = {
        where: filtros,
      };

      if (esParaIA) {
        queryOptions.attributes = [
          'codigoTipoItem',
          'nombreTipo',
          'descripcionTipo',
          'estadoTipo'
        ];
      }

      return await this.model.findAll(queryOptions);

    } catch (error) {
      console.error("Error en TiposItemService:", error);
      throw error;
    }
  }

  async getTipoItemById(codigoTipoItem) {
    const registro = await this.model.findOne({ where: { codigoTipoItem } });
    if (!registro) throw { statusCode: 404, msg: "No existe el tipo de item solicitado." };
    return registro;
  }

  async createTipoItem(rawData) {
    console.log('servicio antes', rawData);

    const dataDTO = TipoItemDTO(rawData);
    console.log('servicio dto', dataDTO);

    return await sequelize.transaction(async (t) => {
      const nuevo = await this.model.create(dataDTO, { transaction: t });

      getIO().emit('tipos-itemes-actualizados', {
        action: 'create',
        msg: `Tipo de Item creado: ${nuevo.nombreTipo}`
      });

      return nuevo;
    });
  }

  async updateTipoItem(codigoTipoItem, rawData) {
    console.log('rawDta antes dto', rawData);

    const dataDTO = TipoItemDTO(rawData);
    console.log('rawDta despues dto', dataDTO);

    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoTipoItem },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: 'No existe el tipo de item para actualizar.' };

      await this.model.update(dataDTO, {
        where: { codigoTipoItem },
        transaction: t
      });

      const actualizado = await this.model.findOne({
        where: { codigoTipoItem },
        transaction: t
      });

      getIO().emit('tipos-itemes-actualizados', {
        action: 'update',
        msg: `Tipo de Item actualizado: ${actualizado.nombreTipo}`
      });

      return actualizado;
    });
  }

  async deleteTipoItem(codigoTipoItem) {
    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoTipoItem },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: 'No existe el tipo de item con ese ID para eliminar.' };

      const nombreTipo = registroDB.nombreTipo;

      await this.model.destroy({
        where: { codigoTipoItem },
        transaction: t
      });

      getIO().emit('tipos-itemes-actualizados', {
        action: 'delete',
        msg: `Tipo de Item eliminado: ${nombreTipo}`
      });

      return true;
    });
  }
}

module.exports = TiposItemService;