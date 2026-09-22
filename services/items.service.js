/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Service Layer Sanitization & Transactional Integrity
*/
const { sequelize } = require('../database/connection');
const { ItemModel, ItemDTO } = require('../models/item');
const { getIO } = require('../helpers/socket.helper');

class ItemService {
  constructor() {
    this.model = ItemModel(sequelize);
  }

  async getItems(filtros = {}, esParaIA = false) {
    try {
      const queryOptions = {
        where: filtros,
      };

      if (esParaIA) {
        queryOptions.attributes = [
          'nombreValor',
          'descripcionValor',
          'valorUnitario',
          'estadoValor'
        ];
      }

      return await this.model.findAll(queryOptions);

    } catch (error) {
      console.error("Error en ItemsService:", error);
      throw error;
    }
  }

  async getItemById(codigoItem) {
    const registro = await this.model.findOne({ where: { codigoItem } });
    if (!registro) throw { statusCode: 404, msg: "No existe el ítem solicitado." };
    return registro;
  }

  async createItem(rawData) {
    console.log('item antes dto', rawData);

    const dataDTO = ItemDTO(rawData);
    console.log('item despues dto', dataDTO);


    return await sequelize.transaction(async (t) => {
      const nuevo = await this.model.create(dataDTO, { transaction: t });

      getIO().emit("items-actualizados", {
        action: "create",
        msg: `Item creado: ${nuevo.nombreItem}`,
      });

      return nuevo;
    });
  }

  async updateItem(codigoItem, rawData) {
    const dataDTO = ItemDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoItem },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: "No existe el ítem para actualizar." };

      await this.model.update(dataDTO, {
        where: { codigoItem },
        transaction: t
      });

      const actualizado = await this.model.findOne({
        where: { codigoItem },
        transaction: t
      });

      getIO().emit("items-actualizados", {
        action: "update",
        msg: `Item actualizado: ${actualizado.nombreItem}`,
      });

      return actualizado;
    });
  }

  async deleteItem(codigoItem) {
    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoItem },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: "No existe el ítem con ese ID para eliminar." };

      const nombreItem = registroDB.nombreItem;

      await this.model.destroy({
        where: { codigoItem },
        transaction: t
      });

      getIO().emit("items-actualizados", {
        action: "delete",
        msg: `Item eliminado: ${nombreItem}`,
      });

      return true;
    });
  }
}

module.exports = ItemService;