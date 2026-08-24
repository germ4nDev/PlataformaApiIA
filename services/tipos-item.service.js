/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Service Layer Sanitization & Transactional Integrity
*/
const { sequelize } = require('../database/connection');
const { TipoItemModel, TipoItemDTO } = require('../models/tipo-item');
const { io } = require('../index');

class TiposItemService {
  constructor() {
    this.model = TipoItemModel(sequelize);
  }

  async getTiposItem() {
    return await this.model.findAll();
  }

  async getTipoItemById(tipoItemId) {
    const registro = await this.model.findOne({ where: { tipoItemId } });
    if (!registro) throw { statusCode: 404, msg: "No existe el tipo de item solicitado." };
    return registro;
  }

  /**
   * Crea un nuevo tipo de ítem
   */
  async createTipoItem(rawData) {
    const dataDTO = TipoItemDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const nuevo = await this.model.create(dataDTO, { transaction: t });

      io.emit('tipos-itemes-actualizados', {
        action: 'create',
        msg: `Tipo de Item creado: ${nuevo.nombreTipo}`
      });

      return nuevo;
    });
  }

  /**
   * Actualiza un tipo de ítem existente
   */
  async updateTipoItem(tipoItemId, rawData) {
    // El controlador inyecta el codigoUsuario en rawData antes de invocar este método
    const dataDTO = TipoItemDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { tipoItemId },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: 'No existe el tipo de item para actualizar.' };

      await this.model.update(dataDTO, {
        where: { tipoItemId },
        transaction: t
      });

      const actualizado = await this.model.findOne({
        where: { tipoItemId },
        transaction: t
      });

      io.emit('tipos-itemes-actualizados', {
        action: 'update',
        msg: `Tipo de Item actualizado: ${actualizado.nombreTipo}`
      });

      return actualizado;
    });
  }

  async deleteTipoItem(tipoItemId) {
    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { tipoItemId },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: 'No existe el tipo de item con ese ID para eliminar.' };

      const nombreTipo = registroDB.nombreTipo;

      await this.model.destroy({
        where: { tipoItemId },
        transaction: t
      });

      io.emit('tipos-itemes-actualizados', {
        action: 'delete',
        msg: `Tipo de Item eliminado: ${nombreTipo}`
      });

      return true;
    });
  }
}

module.exports = TiposItemService;