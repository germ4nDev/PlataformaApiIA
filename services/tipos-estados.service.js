/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Service Layer Sanitization & Transactional Integrity
*/
const { sequelize } = require('../database/connection');
const { TipoEstadoModel, TipoEstadoDTO } = require('../models/tipo-estado');
const { io } = require('../index');

class TipoEstadoService {
  constructor() {
    this.model = TipoEstadoModel(sequelize);
  }

  async getTiposEstados() {
    return await this.model.findAll();
  }

  async getTipoEstadoById(tipoEstadoId) {
    const registro = await this.model.findOne({ where: { tipoEstadoId } });
    if (!registro) throw { statusCode: 404, msg: "No existe el tipo de estado solicitado." };
    return registro;
  }

  /**
   * Crea un nuevo tipo de estado
   */
  async createTipoEstado(rawData) {
    const dataDTO = TipoEstadoDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const nuevo = await this.model.create(dataDTO, { transaction: t });

      io.emit('tipos-estados-actualizados', {
        action: 'create',
        msg: `Tipo de Estado creado: ${nuevo.nombreTipo}`
      });

      return nuevo;
    });
  }

  /**
   * Actualiza un tipo de estado existente
   */
  async updateTipoEstado(tipoEstadoId, rawData) {
    // El controlador inyecta el codigoUsuario en rawData antes de invocar este método
    const dataDTO = TipoEstadoDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { tipoEstadoId },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: 'No existe el tipo de estado para actualizar.' };

      await this.model.update(dataDTO, {
        where: { tipoEstadoId },
        transaction: t
      });

      const actualizado = await this.model.findOne({
        where: { tipoEstadoId },
        transaction: t
      });

      io.emit('tipos-estados-actualizados', {
        action: 'update',
        msg: `Tipo de Estado actualizado: ${actualizado.nombreTipo}`
      });

      return actualizado;
    });
  }

  async deleteTipoEstado(tipoEstadoId) {
    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { tipoEstadoId },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: 'No existe el tipo de estado con ese ID para eliminar.' };

      const nombreTipo = registroDB.nombreTipo;

      await this.model.destroy({
        where: { tipoEstadoId },
        transaction: t
      });

      io.emit('tipos-estados-actualizados', {
        action: 'delete',
        msg: `Tipo de Estado eliminado: ${nombreTipo}`
      });

      return true;
    });
  }
}

module.exports = TipoEstadoService;