/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Service Layer Sanitization & Transactional Integrity
*/
const { sequelize } = require('../database/connection');
const { ItemPaqueteModel, ItemPaqueteDTO } = require('../models/item-paquete');
const { io } = require('../index');

class ItemPaqueteService {
  constructor() {
    this.model = ItemPaqueteModel(sequelize);
  }

  async getItemsPaquete() {
    return await this.model.findAll();
  }

  async getItemPaquetePorId(codigoItem) {
    const registro = await this.model.findOne({ where: { codigoItem } });
    if (!registro) throw { statusCode: 404, msg: "No existe el ítem de paquete solicitado." };
    return registro;
  }

  async getItemsPaquetePorCodigoPaquete(codigoPaquete) {
    const registros = await this.model.findAll({ where: { codigoPaquete } });
    if (!registros || registros.length === 0) {
      throw { statusCode: 404, msg: "No existen ítems para ese código de paquete." };
    }
    return registros;
  }

  /**
   * Crea un nuevo ítem validando unicidad del código
   */
  async createItemPaquete(rawData) {
    const dataDTO = ItemPaqueteDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const existente = await this.model.findOne({
        where: { codigoItem: dataDTO.codigoItem },
        transaction: t
      });

      if (existente) {
        throw { statusCode: 400, msg: `El código ${dataDTO.codigoItem} ya está registrado.` };
      }

      const nuevo = await this.model.create(dataDTO, { transaction: t });

      io.emit('items-paquete-actualizados', {
        action: 'create',
        msg: `Item Paquete creado: ${nuevo.codigoItem}`
      });

      return nuevo;
    });
  }

  /**
   * Actualiza un ítem existente
   */
  async updateItemPaquete(codigoItem, rawData) {
    // El controlador debe inyectar el codigoUsuario en rawData
    const dataDTO = ItemPaqueteDTO(rawData);

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

      io.emit('items-paquete-actualizados', {
        action: 'update',
        msg: `Item actualizado: ${actualizado.nombreItem}`
      });

      return actualizado;
    });
  }

  async deleteItemPaquete(codigoItem) {
    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoItem },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: "No existe el ítem para eliminar." };

      const nombreItem = registroDB.nombreItem;

      await this.model.destroy({
        where: { codigoItem },
        transaction: t
      });

      io.emit('items-paquete-actualizados', {
        action: 'delete',
        msg: `Item eliminado: ${nombreItem}`
      });

      return true;
    });
  }
}

module.exports = ItemPaqueteService;